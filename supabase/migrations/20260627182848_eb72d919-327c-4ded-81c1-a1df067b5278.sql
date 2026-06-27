
-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  severity text NOT NULL DEFAULT 'info',
  channel text NOT NULL DEFAULT 'in_app',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications(user_id, read_at, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "managers can insert notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.notify(
  _user uuid, _kind text, _title text, _body text DEFAULT NULL,
  _link text DEFAULT NULL, _severity text DEFAULT 'info', _channel text DEFAULT 'in_app'
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications(user_id, kind, title, body, link, severity, channel, organization_id)
  VALUES (_user, _kind, _title, _body, _link, _severity, _channel,
    (SELECT organization_id FROM public.profiles WHERE id = _user LIMIT 1))
  RETURNING id
$$;

CREATE OR REPLACE FUNCTION public.notify_task_assigned() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    PERFORM public.notify(NEW.assigned_to, 'task_assigned',
      'Task assigned: ' || COALESCE(NEW.title,''), NEW.description, '/tasks', 'info');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- ============ COMPLAINTS ============
DO $$ BEGIN
  CREATE TYPE public.complaint_status AS ENUM ('open','investigating','resolved','closed','escalated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.complaint_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  call_id uuid REFERENCES public.calls(id) ON DELETE SET NULL,
  category text,
  subject text NOT NULL,
  description text,
  priority public.complaint_priority NOT NULL DEFAULT 'normal',
  status public.complaint_status NOT NULL DEFAULT 'open',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  raised_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaints read auth" ON public.complaints FOR SELECT
  USING (raised_by = auth.uid() OR owner_id = auth.uid() OR public.max_role_level(auth.uid()) >= 2);
CREATE POLICY "complaints insert auth" ON public.complaints FOR INSERT WITH CHECK (raised_by = auth.uid());
CREATE POLICY "complaints update owners+leaders" ON public.complaints FOR UPDATE
  USING (owner_id = auth.uid() OR public.max_role_level(auth.uid()) >= 3);
CREATE TRIGGER touch_complaints BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.complaint_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  status_change public.complaint_status,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.complaint_updates TO authenticated;
GRANT ALL ON public.complaint_updates TO service_role;
ALTER TABLE public.complaint_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaint updates read" ON public.complaint_updates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id
    AND (c.raised_by = auth.uid() OR c.owner_id = auth.uid() OR public.max_role_level(auth.uid()) >= 2)));
CREATE POLICY "complaint updates insert" ON public.complaint_updates FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_complaint() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
    PERFORM public.notify(NEW.owner_id, 'complaint_assigned',
      'Complaint: ' || NEW.subject, NEW.description, '/complaints', 'warning');
  END IF;
  IF TG_OP='UPDATE' AND NEW.status='escalated' AND OLD.status IS DISTINCT FROM 'escalated' THEN
    IF NEW.owner_id IS NOT NULL THEN
      PERFORM public.notify(NEW.owner_id, 'complaint_escalated',
        'Escalated: ' || NEW.subject, NEW.resolution, '/complaints', 'danger');
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notify_complaint ON public.complaints;
CREATE TRIGGER trg_notify_complaint AFTER INSERT OR UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.notify_complaint();

-- ============ ATTENDANCE & SHIFTS ============
CREATE TABLE IF NOT EXISTS public.attendance_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attendance_shifts_user_idx ON public.attendance_shifts(user_id, starts_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_shifts TO authenticated;
GRANT ALL ON public.attendance_shifts TO service_role;
ALTER TABLE public.attendance_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts read" ON public.attendance_shifts FOR SELECT
  USING (user_id = auth.uid() OR public.max_role_level(auth.uid()) >= 2);
CREATE POLICY "shifts manage leaders" ON public.attendance_shifts FOR ALL
  USING (public.max_role_level(auth.uid()) >= 2)
  WITH CHECK (public.max_role_level(auth.uid()) >= 2);

CREATE TABLE IF NOT EXISTS public.attendance_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('clock_in','clock_out','break_start','break_end')),
  at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE INDEX IF NOT EXISTS punches_user_at_idx ON public.attendance_punches(user_id, at DESC);
GRANT SELECT, INSERT ON public.attendance_punches TO authenticated;
GRANT ALL ON public.attendance_punches TO service_role;
ALTER TABLE public.attendance_punches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "punches own" ON public.attendance_punches FOR SELECT
  USING (user_id = auth.uid() OR public.max_role_level(auth.uid()) >= 2);
CREATE POLICY "punches insert self" ON public.attendance_punches FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============ ANNOUNCEMENTS ============
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  urgency text NOT NULL DEFAULT 'normal',
  require_ack boolean NOT NULL DEFAULT false,
  audience text NOT NULL DEFAULT 'team',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements read all auth" ON public.announcements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "announcements write leaders" ON public.announcements FOR INSERT
  WITH CHECK (public.max_role_level(auth.uid()) >= 2 AND author_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);
GRANT SELECT, INSERT ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcement_reads TO service_role;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ack read self" ON public.announcement_reads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ack insert self" ON public.announcement_reads FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============ COMPLIANCE / DATA REQUESTS ============
CREATE TABLE IF NOT EXISTS public.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('export','deletion','restriction','access')),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  fulfilled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_requests TO authenticated;
GRANT ALL ON public.data_requests TO service_role;
ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dsar read" ON public.data_requests FOR SELECT
  USING (requested_by = auth.uid() OR public.max_role_level(auth.uid()) >= 3);
CREATE POLICY "dsar insert" ON public.data_requests FOR INSERT WITH CHECK (requested_by = auth.uid());
CREATE POLICY "dsar review" ON public.data_requests FOR UPDATE
  USING (public.max_role_level(auth.uid()) >= 4);

-- ============ INTEGRATIONS REGISTRY ============
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','connected','error')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  configured_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations read leaders" ON public.integrations FOR SELECT
  USING (public.max_role_level(auth.uid()) >= 3);
CREATE POLICY "integrations write admins" ON public.integrations FOR ALL
  USING (public.max_role_level(auth.uid()) >= 4)
  WITH CHECK (public.max_role_level(auth.uid()) >= 4);
CREATE TRIGGER touch_integrations BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ REPORT RUNS ============
CREATE TABLE IF NOT EXISTS public.report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_key text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  format text NOT NULL DEFAULT 'csv',
  row_count integer,
  run_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.report_runs TO authenticated;
GRANT ALL ON public.report_runs TO service_role;
ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports read" ON public.report_runs FOR SELECT
  USING (run_by = auth.uid() OR public.max_role_level(auth.uid()) >= 3);
CREATE POLICY "reports insert auth" ON public.report_runs FOR INSERT
  WITH CHECK (run_by = auth.uid());
