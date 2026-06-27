
-- ============================================================
-- Phase 3A — Client management
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.client_status AS ENUM (
    'new','assigned','contacted','follow_up',
    'interested','not_interested',
    'converted','unreachable','invalid',
    'complaint','escalated','do_not_call','closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contact_method AS ENUM ('phone','email','sms','whatsapp','no_contact');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.consent_state AS ENUM ('unknown','granted','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_change_state AS ENUM ('pending','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend contacts
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS alt_phone           text,
  ADD COLUMN IF NOT EXISTS address_line1       text,
  ADD COLUMN IF NOT EXISTS address_line2       text,
  ADD COLUMN IF NOT EXISTS address_city        text,
  ADD COLUMN IF NOT EXISTS address_region      text,
  ADD COLUMN IF NOT EXISTS address_postcode    text,
  ADD COLUMN IF NOT EXISTS address_country     text,
  ADD COLUMN IF NOT EXISTS dob                 date,
  ADD COLUMN IF NOT EXISTS preferred_method    public.contact_method NOT NULL DEFAULT 'phone',
  ADD COLUMN IF NOT EXISTS preferred_time      text,
  ADD COLUMN IF NOT EXISTS category            text,
  ADD COLUMN IF NOT EXISTS lifecycle_status    public.client_status NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS assigned_agent_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_team_id    uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_source     text,
  ADD COLUMN IF NOT EXISTS consent_status      public.consent_state NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS do_not_call         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_contacted_at   timestamptz,
  ADD COLUMN IF NOT EXISTS next_follow_up_at   timestamptz,
  ADD COLUMN IF NOT EXISTS organization_id     uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_into_id      uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at          timestamptz;

UPDATE public.contacts c
SET organization_id = p.organization_id
FROM public.profiles p
WHERE c.organization_id IS NULL AND p.id = c.owner_id;

CREATE INDEX IF NOT EXISTS contacts_phone_idx         ON public.contacts (phone);
CREATE INDEX IF NOT EXISTS contacts_email_idx         ON public.contacts (lower(email));
CREATE INDEX IF NOT EXISTS contacts_assigned_idx      ON public.contacts (assigned_agent_id);
CREATE INDEX IF NOT EXISTS contacts_team_idx          ON public.contacts (assigned_team_id);
CREATE INDEX IF NOT EXISTS contacts_status_idx        ON public.contacts (lifecycle_status);
CREATE INDEX IF NOT EXISTS contacts_org_status_idx    ON public.contacts (organization_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS contacts_next_followup_idx ON public.contacts (next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS contacts_name_trgm_idx     ON public.contacts USING gin (name gin_trgm_ops);

-- 3. Status transition validation
CREATE OR REPLACE FUNCTION public.is_valid_client_transition(_from public.client_status, _to public.client_status)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _from = _to THEN true
    WHEN _to IN ('do_not_call','escalated','complaint','invalid','closed') THEN true
    WHEN _from = 'new'            AND _to IN ('assigned','unreachable')                                        THEN true
    WHEN _from = 'assigned'       AND _to IN ('contacted','unreachable','follow_up')                           THEN true
    WHEN _from = 'contacted'      AND _to IN ('interested','not_interested','follow_up','unreachable')         THEN true
    WHEN _from = 'follow_up'      AND _to IN ('contacted','interested','not_interested','unreachable')         THEN true
    WHEN _from = 'interested'     AND _to IN ('converted','follow_up','not_interested')                        THEN true
    WHEN _from = 'not_interested' AND _to IN ('follow_up','closed')                                            THEN true
    WHEN _from = 'unreachable'    AND _to IN ('contacted','follow_up','closed')                                THEN true
    WHEN _from = 'converted'      AND _to IN ('closed')                                                        THEN true
    ELSE false
  END;
$$;

CREATE TABLE IF NOT EXISTS public.client_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  from_status public.client_status,
  to_status   public.client_status NOT NULL,
  changed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.client_status_transitions TO authenticated;
GRANT ALL ON public.client_status_transitions TO service_role;
ALTER TABLE public.client_status_transitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "transitions: read for client viewers" ON public.client_status_transitions;
CREATE POLICY "transitions: read for client viewers" ON public.client_status_transitions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = client_id));
DROP POLICY IF EXISTS "transitions: insert via trigger only" ON public.client_status_transitions;
CREATE POLICY "transitions: insert via trigger only" ON public.client_status_transitions
  FOR INSERT TO authenticated WITH CHECK (changed_by = auth.uid() OR changed_by IS NULL);
CREATE INDEX IF NOT EXISTS cst_client_idx ON public.client_status_transitions (client_id, at DESC);

CREATE OR REPLACE FUNCTION public.enforce_client_status_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
    IF NOT public.is_valid_client_transition(OLD.lifecycle_status, NEW.lifecycle_status) THEN
      RAISE EXCEPTION 'Invalid client status transition: % -> %', OLD.lifecycle_status, NEW.lifecycle_status
        USING ERRCODE = 'check_violation';
    END IF;
    INSERT INTO public.client_status_transitions(client_id, from_status, to_status, changed_by)
      VALUES (NEW.id, OLD.lifecycle_status, NEW.lifecycle_status, auth.uid());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.client_status_transitions(client_id, from_status, to_status, changed_by)
      VALUES (NEW.id, NULL, NEW.lifecycle_status, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contacts_status ON public.contacts;
CREATE TRIGGER trg_contacts_status
  AFTER INSERT OR UPDATE OF lifecycle_status ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_client_status_transition();

-- 4. Field-change approvals
CREATE TABLE IF NOT EXISTS public.client_change_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field        text NOT NULL,
  old_value    text,
  new_value    text,
  reason       text,
  state        public.client_change_state NOT NULL DEFAULT 'pending',
  reviewed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.client_change_approvals TO authenticated;
GRANT ALL ON public.client_change_approvals TO service_role;
ALTER TABLE public.client_change_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "approvals: requester or reviewer read" ON public.client_change_approvals;
CREATE POLICY "approvals: requester or reviewer read" ON public.client_change_approvals
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.max_role_level(auth.uid()) >= 3);
DROP POLICY IF EXISTS "approvals: agent insert own" ON public.client_change_approvals;
CREATE POLICY "approvals: agent insert own" ON public.client_change_approvals
  FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());
DROP POLICY IF EXISTS "approvals: supervisor review" ON public.client_change_approvals;
CREATE POLICY "approvals: supervisor review" ON public.client_change_approvals
  FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'clients:approve_changes'))
  WITH CHECK (public.has_permission(auth.uid(),'clients:approve_changes'));
CREATE INDEX IF NOT EXISTS cca_state_idx  ON public.client_change_approvals (state, created_at DESC);
CREATE INDEX IF NOT EXISTS cca_client_idx ON public.client_change_approvals (client_id);

-- 5. Documents
CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  uploaded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  filename     text NOT NULL,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.client_documents TO authenticated;
GRANT ALL ON public.client_documents TO service_role;
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "docs: read for client viewers" ON public.client_documents;
CREATE POLICY "docs: read for client viewers" ON public.client_documents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = client_id));
DROP POLICY IF EXISTS "docs: uploader insert" ON public.client_documents;
CREATE POLICY "docs: uploader insert" ON public.client_documents
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
DROP POLICY IF EXISTS "docs: uploader or supervisor delete" ON public.client_documents;
CREATE POLICY "docs: uploader or supervisor delete" ON public.client_documents
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.max_role_level(auth.uid()) >= 3);
CREATE INDEX IF NOT EXISTS cd_client_idx ON public.client_documents (client_id, created_at DESC);

-- 6. Merges audit
CREATE TABLE IF NOT EXISTS public.client_merges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surviving_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  merged_id    uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  merged_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  snapshot     jsonb NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.client_merges TO authenticated;
GRANT ALL ON public.client_merges TO service_role;
ALTER TABLE public.client_merges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "merges: supervisor read" ON public.client_merges;
CREATE POLICY "merges: supervisor read" ON public.client_merges
  FOR SELECT TO authenticated USING (public.max_role_level(auth.uid()) >= 3);
DROP POLICY IF EXISTS "merges: supervisor insert" ON public.client_merges;
CREATE POLICY "merges: supervisor insert" ON public.client_merges
  FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(),'clients:merge'));

-- 7. Replace contacts RLS
DROP POLICY IF EXISTS "contacts: owner delete"                  ON public.contacts;
DROP POLICY IF EXISTS "contacts: owner insert"                  ON public.contacts;
DROP POLICY IF EXISTS "contacts: owner or supervisor+ read"     ON public.contacts;
DROP POLICY IF EXISTS "contacts: owner update"                  ON public.contacts;
DROP POLICY IF EXISTS "clients: scoped read"      ON public.contacts;
DROP POLICY IF EXISTS "clients: agent insert own" ON public.contacts;
DROP POLICY IF EXISTS "clients: scoped update"    ON public.contacts;
DROP POLICY IF EXISTS "clients: ops_admin delete" ON public.contacts;

CREATE POLICY "clients: scoped read" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      owner_id = auth.uid()
      OR assigned_agent_id = auth.uid()
      OR (
        public.max_role_level(auth.uid()) >= 2
        AND assigned_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
      )
      OR public.max_role_level(auth.uid()) >= 3
    )
  );

CREATE POLICY "clients: agent insert own" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.has_permission(auth.uid(),'clients:write_assigned'));

CREATE POLICY "clients: scoped update" ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR assigned_agent_id = auth.uid()
    OR (public.max_role_level(auth.uid()) >= 2
        AND assigned_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
    OR public.max_role_level(auth.uid()) >= 3
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR assigned_agent_id = auth.uid()
    OR (public.max_role_level(auth.uid()) >= 2
        AND assigned_team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
    OR public.max_role_level(auth.uid()) >= 3
  );

CREATE POLICY "clients: ops_admin delete" ON public.contacts
  FOR DELETE TO authenticated
  USING (public.has_permission(auth.uid(),'clients:delete'));

-- 8. Seed permissions
INSERT INTO public.role_permissions(role, permission) VALUES
  ('agent','clients:read_assigned'),
  ('agent','clients:write_assigned'),
  ('team_leader','clients:read_team'),
  ('team_leader','clients:bulk_assign'),
  ('team_leader','clients:transfer'),
  ('supervisor','clients:read_org'),
  ('supervisor','clients:import'),
  ('supervisor','clients:export'),
  ('supervisor','clients:view_sensitive'),
  ('supervisor','clients:approve_changes'),
  ('supervisor','clients:merge'),
  ('ops_admin','clients:delete')
ON CONFLICT DO NOTHING;

-- 9. Storage policies for client-documents
DO $$ BEGIN
  EXECUTE 'CREATE POLICY "client-docs: read for viewers" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = ''client-documents'')';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "client-docs: authenticated insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = ''client-documents'' AND owner = auth.uid())';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  EXECUTE 'CREATE POLICY "client-docs: owner or supervisor delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = ''client-documents'' AND (owner = auth.uid() OR public.max_role_level(auth.uid()) >= 3))';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
