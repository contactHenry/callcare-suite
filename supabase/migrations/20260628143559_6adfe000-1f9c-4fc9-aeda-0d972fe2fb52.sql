
-- ============================================================
-- Phase 1: Data model corrections
-- ============================================================

-- 1A. client_contact_methods ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_contact_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  method public.contact_method NOT NULL,
  value text NOT NULL,
  normalized_value text,
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contact_methods TO authenticated;
GRANT ALL ON public.client_contact_methods TO service_role;
ALTER TABLE public.client_contact_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccm_read_signed_in" ON public.client_contact_methods
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ccm_write_clients_edit" ON public.client_contact_methods
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'clients:edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'clients:edit'));

CREATE INDEX IF NOT EXISTS ccm_client_idx ON public.client_contact_methods(client_id);
CREATE INDEX IF NOT EXISTS ccm_normalized_idx ON public.client_contact_methods(normalized_value)
  WHERE normalized_value IS NOT NULL;
CREATE INDEX IF NOT EXISTS ccm_value_trgm_idx ON public.client_contact_methods USING gin (value gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_ccm_touch ON public.client_contact_methods;
CREATE TRIGGER trg_ccm_touch BEFORE UPDATE ON public.client_contact_methods
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.client_contact_methods (client_id, organization_id, method, value, normalized_value, label, is_primary)
SELECT id, organization_id, 'phone'::public.contact_method, phone,
       regexp_replace(phone, '[^0-9+]', '', 'g'), 'primary', true
FROM public.contacts WHERE phone IS NOT NULL AND btrim(phone) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.client_contact_methods (client_id, organization_id, method, value, normalized_value, label, is_primary)
SELECT id, organization_id, 'phone'::public.contact_method, alt_phone,
       regexp_replace(alt_phone, '[^0-9+]', '', 'g'), 'alternate', false
FROM public.contacts WHERE alt_phone IS NOT NULL AND btrim(alt_phone) <> ''
ON CONFLICT DO NOTHING;

INSERT INTO public.client_contact_methods (client_id, organization_id, method, value, normalized_value, label, is_primary)
SELECT id, organization_id, 'email'::public.contact_method, email,
       lower(email), 'primary', true
FROM public.contacts WHERE email IS NOT NULL AND btrim(email) <> ''
ON CONFLICT DO NOTHING;

-- 1B. client_consents -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  consent_type text NOT NULL,
  state public.consent_state NOT NULL,
  source text,
  captured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  evidence_url text,
  notes text,
  superseded_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.client_consents TO authenticated;
GRANT ALL ON public.client_consents TO service_role;
ALTER TABLE public.client_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consents_read_signed_in" ON public.client_consents
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "consents_insert_clients_edit" ON public.client_consents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(), 'clients:edit'));
CREATE POLICY "consents_update_clients_edit" ON public.client_consents
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'clients:edit'))
  WITH CHECK (public.has_permission(auth.uid(), 'clients:edit'));

CREATE INDEX IF NOT EXISTS consents_client_idx ON public.client_consents(client_id, consent_type, captured_at DESC);

INSERT INTO public.client_consents (client_id, organization_id, consent_type, state, source, captured_at)
SELECT id, organization_id, 'marketing', consent_status, 'backfill', created_at
FROM public.contacts;

INSERT INTO public.client_consents (client_id, organization_id, consent_type, state, source, captured_at)
SELECT id, organization_id, 'calling',
       CASE WHEN do_not_call THEN 'revoked'::public.consent_state ELSE 'granted'::public.consent_state END,
       'backfill', created_at
FROM public.contacts;

-- 1C. Forward-compat view ---------------------------------------------------
DROP VIEW IF EXISTS public.client_profiles;
CREATE VIEW public.client_profiles
WITH (security_invoker = true) AS
  SELECT * FROM public.contacts WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.client_profiles TO authenticated;
COMMENT ON VIEW public.client_profiles IS
  'Forward-compatible PRD name for contacts. Prefer client_profiles in new code; existing code using contacts keeps working.';

COMMENT ON COLUMN public.contacts.phone IS 'DEPRECATED. Use client_contact_methods.';
COMMENT ON COLUMN public.contacts.alt_phone IS 'DEPRECATED. Use client_contact_methods.';
COMMENT ON COLUMN public.contacts.email IS 'DEPRECATED. Use client_contact_methods.';
COMMENT ON COLUMN public.contacts.consent_status IS 'DEPRECATED. Use client_consents (consent_type=marketing).';
COMMENT ON COLUMN public.contacts.do_not_call IS 'DEPRECATED. Use client_consents (consent_type=calling).';

-- 2. calls.disposition_id ---------------------------------------------------
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS disposition_id uuid REFERENCES public.call_outcome_definitions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS calls_disposition_idx ON public.calls(disposition_id);

CREATE OR REPLACE FUNCTION public.enforce_call_disposition_campaign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_disp_campaign uuid;
BEGIN
  IF NEW.disposition_id IS NULL OR NEW.campaign_id IS NULL THEN RETURN NEW; END IF;
  SELECT campaign_id INTO v_disp_campaign FROM public.call_outcome_definitions WHERE id = NEW.disposition_id;
  IF v_disp_campaign IS NOT NULL AND v_disp_campaign <> NEW.campaign_id THEN
    RAISE EXCEPTION 'Disposition % does not belong to campaign %', NEW.disposition_id, NEW.campaign_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_calls_disposition_campaign ON public.calls;
CREATE TRIGGER trg_calls_disposition_campaign BEFORE INSERT OR UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.enforce_call_disposition_campaign();

-- 3. Team-scoped RLS for team leaders --------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_leader_of(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = _user_id AND tm.team_id = _team_id
      AND public.has_role(_user_id, 'team_leader')
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_team_leader_of(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "calls_team_leader_read" ON public.calls;
CREATE POLICY "calls_team_leader_read" ON public.calls
  FOR SELECT TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_leader_of(auth.uid(), team_id));

-- 4. First user auto-promoted to ops_admin ---------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  default_org uuid;
  existing_count int;
  granted_role public.app_role;
BEGIN
  SELECT id INTO default_org FROM public.organizations WHERE slug='default' LIMIT 1;
  SELECT count(*) INTO existing_count FROM public.profiles WHERE organization_id = default_org;
  granted_role := CASE WHEN existing_count = 0 THEN 'ops_admin'::public.app_role ELSE 'agent'::public.app_role END;
  INSERT INTO public.profiles (id, full_name, organization_id)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), default_org);
  INSERT INTO public.user_roles (user_id, role, organization_id)
    VALUES (NEW.id, granted_role, default_org);
  INSERT INTO public.agent_availability (user_id, status) VALUES (NEW.id, 'offline');
  RETURN NEW;
END $$;
