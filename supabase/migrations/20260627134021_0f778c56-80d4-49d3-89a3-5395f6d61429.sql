
-- ============================================================
-- CALLING INFRASTRUCTURE — Phase 4A
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.call_status AS ENUM (
    'queued','ringing','in_progress','on_hold','completed',
    'failed','no_answer','busy','voicemail','abandoned','canceled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.call_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.transfer_kind AS ENUM ('warm','cold','conference');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.monitor_kind AS ENUM ('listen','whisper','barge','takeover');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- campaigns ----------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  dial_mode TEXT NOT NULL DEFAULT 'preview' CHECK (dial_mode IN ('preview','progressive','power','predictive','manual')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaigns_org_read" ON public.campaigns FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "campaigns_manager_write" ON public.campaigns FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'staff:manage'))
  WITH CHECK (public.has_permission(auth.uid(),'staff:manage'));

-- ---------- caller IDs ----------
CREATE TABLE IF NOT EXISTS public.caller_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  e164_number TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.caller_ids TO authenticated;
GRANT ALL ON public.caller_ids TO service_role;
ALTER TABLE public.caller_ids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "caller_ids_read" ON public.caller_ids FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "caller_ids_manage" ON public.caller_ids FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'staff:manage'))
  WITH CHECK (public.has_permission(auth.uid(),'staff:manage'));

-- ---------- telephony settings ----------
CREATE TABLE IF NOT EXISTS public.telephony_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stub',
  recording_enabled BOOLEAN NOT NULL DEFAULT true,
  recording_consent_notice TEXT DEFAULT 'This call may be recorded for quality and training purposes.',
  recording_consent_required BOOLEAN NOT NULL DEFAULT true,
  voicemail_drop_enabled BOOLEAN NOT NULL DEFAULT false,
  voicemail_drop_legal_ack BOOLEAN NOT NULL DEFAULT false,
  two_party_consent_regions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  default_inbound_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT, INSERT, UPDATE ON public.telephony_settings TO authenticated;
GRANT ALL ON public.telephony_settings TO service_role;
ALTER TABLE public.telephony_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telephony_read" ON public.telephony_settings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "telephony_manage" ON public.telephony_settings FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'calls:manage_telephony'))
  WITH CHECK (public.has_permission(auth.uid(),'calls:manage_telephony'));

-- ---------- extend calls ----------
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS caller_id_used UUID REFERENCES public.caller_ids(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS from_number TEXT,
  ADD COLUMN IF NOT EXISTS to_number TEXT,
  ADD COLUMN IF NOT EXISTS status public.call_status NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_call_sid TEXT,
  ADD COLUMN IF NOT EXISTS recording_path TEXT,
  ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS recording_sensitive BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recording_masked_ranges JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS voicemail_detected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voicemail_dropped BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS supervisor_comments TEXT,
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS calls_status_idx ON public.calls(status);
CREATE INDEX IF NOT EXISTS calls_agent_started_idx ON public.calls(agent_id, started_at DESC);
CREATE INDEX IF NOT EXISTS calls_team_started_idx ON public.calls(team_id, started_at DESC);
CREATE INDEX IF NOT EXISTS calls_contact_started_idx ON public.calls(contact_id, started_at DESC);
CREATE INDEX IF NOT EXISTS calls_campaign_idx ON public.calls(campaign_id);
CREATE INDEX IF NOT EXISTS calls_from_number_idx ON public.calls(from_number);
CREATE INDEX IF NOT EXISTS calls_to_number_idx ON public.calls(to_number);

DROP TRIGGER IF EXISTS trg_calls_updated_at ON public.calls;
CREATE TRIGGER trg_calls_updated_at BEFORE UPDATE ON public.calls
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Refresh RLS: agents see their own + their team's via supervisor permission
DROP POLICY IF EXISTS "Agents view their calls" ON public.calls;
DROP POLICY IF EXISTS "Managers view all calls" ON public.calls;
DROP POLICY IF EXISTS "Agents insert their calls" ON public.calls;
DROP POLICY IF EXISTS "Agents update their calls" ON public.calls;

CREATE POLICY "calls_read_scope" ON public.calls FOR SELECT TO authenticated USING (
  agent_id = auth.uid()
  OR public.has_permission(auth.uid(),'staff:view_all')
  OR (team_id IS NOT NULL AND team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ) AND public.has_permission(auth.uid(),'staff:view_team'))
);
CREATE POLICY "calls_insert_self" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.has_permission(auth.uid(),'staff:manage'));
CREATE POLICY "calls_update_scope" ON public.calls FOR UPDATE TO authenticated USING (
  agent_id = auth.uid() OR public.has_permission(auth.uid(),'staff:view_team') OR public.has_permission(auth.uid(),'staff:view_all')
);

-- ---------- call transfers ----------
CREATE TABLE IF NOT EXISTS public.call_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  from_agent_id UUID,
  to_agent_id UUID,
  to_team_id UUID,
  kind public.transfer_kind NOT NULL DEFAULT 'warm',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.call_transfers TO authenticated;
GRANT ALL ON public.call_transfers TO service_role;
ALTER TABLE public.call_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfers_read" ON public.call_transfers FOR SELECT TO authenticated USING (
  call_id IN (SELECT id FROM public.calls)
);
CREATE POLICY "transfers_write" ON public.call_transfers FOR INSERT TO authenticated
  WITH CHECK (from_agent_id = auth.uid() OR public.has_permission(auth.uid(),'staff:view_team'));

-- ---------- call queue ----------
CREATE TABLE IF NOT EXISTS public.call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  call_id UUID REFERENCES public.calls(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  from_number TEXT,
  to_number TEXT,
  priority INTEGER NOT NULL DEFAULT 5,
  estimated_wait_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','assigned','answered','abandoned')),
  assigned_agent_id UUID,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_queue TO authenticated;
GRANT ALL ON public.call_queue TO service_role;
ALTER TABLE public.call_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "queue_read" ON public.call_queue FOR SELECT TO authenticated USING (
  organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "queue_update_team" ON public.call_queue FOR UPDATE TO authenticated USING (
  assigned_agent_id = auth.uid() OR public.has_permission(auth.uid(),'staff:view_team')
);
CREATE POLICY "queue_insert_service" ON public.call_queue FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'staff:view_team'));

CREATE INDEX IF NOT EXISTS queue_status_priority_idx ON public.call_queue(status, priority DESC, queued_at);

-- ---------- recording access log ----------
CREATE TABLE IF NOT EXISTS public.call_recording_access_log (
  id BIGSERIAL PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip INET,
  user_agent TEXT,
  reason TEXT
);
GRANT SELECT, INSERT ON public.call_recording_access_log TO authenticated;
GRANT USAGE ON SEQUENCE public.call_recording_access_log_id_seq TO authenticated;
GRANT ALL ON public.call_recording_access_log TO service_role;
GRANT ALL ON SEQUENCE public.call_recording_access_log_id_seq TO service_role;
ALTER TABLE public.call_recording_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec_access_read" ON public.call_recording_access_log FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.has_permission(auth.uid(),'staff:view_all')
);
CREATE POLICY "rec_access_insert" ON public.call_recording_access_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ---------- review tags ----------
CREATE TABLE IF NOT EXISTS public.call_review_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  note TEXT,
  marked_for TEXT CHECK (marked_for IN ('coaching','compliance','escalation','exemplar')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_review_tags TO authenticated;
GRANT ALL ON public.call_review_tags TO service_role;
ALTER TABLE public.call_review_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review_tags_read" ON public.call_review_tags FOR SELECT TO authenticated USING (
  call_id IN (SELECT id FROM public.calls)
);
CREATE POLICY "review_tags_write" ON public.call_review_tags FOR ALL TO authenticated USING (
  public.has_permission(auth.uid(),'staff:view_team')
) WITH CHECK (
  created_by = auth.uid() AND public.has_permission(auth.uid(),'staff:view_team')
);

-- ---------- monitoring sessions ----------
CREATE TABLE IF NOT EXISTS public.call_monitoring_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL,
  kind public.monitor_kind NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  notes TEXT
);
GRANT SELECT, INSERT, UPDATE ON public.call_monitoring_sessions TO authenticated;
GRANT ALL ON public.call_monitoring_sessions TO service_role;
ALTER TABLE public.call_monitoring_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitor_read" ON public.call_monitoring_sessions FOR SELECT TO authenticated USING (
  supervisor_id = auth.uid() OR public.has_permission(auth.uid(),'staff:view_all')
);
CREATE POLICY "monitor_write" ON public.call_monitoring_sessions FOR ALL TO authenticated USING (
  supervisor_id = auth.uid()
) WITH CHECK (
  supervisor_id = auth.uid() AND public.has_permission(auth.uid(), CASE kind
    WHEN 'listen' THEN 'calls:monitor_listen'
    WHEN 'whisper' THEN 'calls:monitor_whisper'
    WHEN 'barge' THEN 'calls:monitor_barge'
    WHEN 'takeover' THEN 'calls:monitor_takeover'
  END)
);

-- ---------- seed new permissions ----------
INSERT INTO public.role_permissions (role, permission) VALUES
  ('team_leader','calls:monitor_listen'),
  ('team_leader','calls:monitor_whisper'),
  ('supervisor','calls:monitor_barge'),
  ('supervisor','calls:monitor_takeover'),
  ('agent','calls:play_recording'),
  ('supervisor','calls:play_sensitive_recording'),
  ('ops_admin','calls:manage_telephony'),
  ('team_leader','calls:voicemail_drop')
ON CONFLICT DO NOTHING;

-- Default telephony settings row per existing org
INSERT INTO public.telephony_settings(organization_id)
  SELECT id FROM public.organizations
  ON CONFLICT DO NOTHING;
