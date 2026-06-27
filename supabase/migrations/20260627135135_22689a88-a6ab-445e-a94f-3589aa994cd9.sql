
-- =========================================================
-- Phase 5: Workflow layer (outcomes, notes, tasks, scripts, QA)
-- =========================================================

-- ---------- Configurable call outcomes per campaign ----------
CREATE TABLE public.call_outcome_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  polarity TEXT NOT NULL DEFAULT 'neutral' CHECK (polarity IN ('positive','neutral','negative')),
  requires_follow_up BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_outcome_definitions TO authenticated;
GRANT ALL ON public.call_outcome_definitions TO service_role;
ALTER TABLE public.call_outcome_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outcomes readable to org members"
  ON public.call_outcome_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "outcomes manageable by supervisors+"
  ON public.call_outcome_definitions FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid()) >= 3)
  WITH CHECK (public.max_role_level(auth.uid()) >= 3);
CREATE TRIGGER trg_outcomes_touch BEFORE UPDATE ON public.call_outcome_definitions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- After-call notes ----------
CREATE TABLE public.call_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome_code TEXT,
  summary TEXT,
  concerns TEXT,
  action_required TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  complaint BOOLEAN NOT NULL DEFAULT false,
  consent_update TEXT,
  next_action TEXT,
  follow_up_task_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_notes TO authenticated;
GRANT ALL ON public.call_notes TO service_role;
ALTER TABLE public.call_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent reads own notes; leaders+ read all"
  ON public.call_notes FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.max_role_level(auth.uid()) >= 2);
CREATE POLICY "agent writes own notes"
  ON public.call_notes FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());
CREATE POLICY "agent updates own notes; supervisors+ update all"
  ON public.call_notes FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR public.max_role_level(auth.uid()) >= 3);
CREATE TRIGGER trg_call_notes_touch BEFORE UPDATE ON public.call_notes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_call_notes_call ON public.call_notes(call_id);
CREATE INDEX idx_call_notes_agent ON public.call_notes(agent_id);

-- ---------- Tasks / follow-ups ----------
CREATE TYPE public.task_status AS ENUM ('open','in_progress','completed','cancelled','escalated');
CREATE TYPE public.task_kind AS ENUM ('follow_up','callback','admin','coaching','escalation','other');

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  kind public.task_kind NOT NULL DEFAULT 'follow_up',
  status public.task_status NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  client_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  call_id UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  remind_at TIMESTAMPTZ,
  recurrence_rule TEXT,
  escalated BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  completion_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task readable by assignee, team leader+, creator"
  ON public.tasks FOR SELECT TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR public.max_role_level(auth.uid()) >= 2
  );
CREATE POLICY "task insert by authenticated"
  ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "task update by assignee or leader+"
  ON public.tasks FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR public.max_role_level(auth.uid()) >= 2);
CREATE POLICY "task delete by supervisors+"
  ON public.tasks FOR DELETE TO authenticated
  USING (public.max_role_level(auth.uid()) >= 3);
CREATE TRIGGER trg_tasks_touch BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_tasks_assignee_due ON public.tasks(assigned_to, due_at);
CREATE INDEX idx_tasks_team_due ON public.tasks(assigned_team_id, due_at);
CREATE INDEX idx_tasks_client ON public.tasks(client_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);

ALTER TABLE public.call_notes
  ADD CONSTRAINT call_notes_follow_up_task_fk
  FOREIGN KEY (follow_up_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_comments read if task visible"
  ON public.task_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
    AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid() OR public.max_role_level(auth.uid()) >= 2)));
CREATE POLICY "task_comments write by author"
  ON public.task_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE INDEX idx_task_comments_task ON public.task_comments(task_id);

CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_attachments read if task visible"
  ON public.task_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id
    AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid() OR public.max_role_level(auth.uid()) >= 2)));
CREATE POLICY "task_attachments write by uploader"
  ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- ---------- Call scripts ----------
CREATE TYPE public.script_status AS ENUM ('draft','in_review','approved','archived');

CREATE TABLE public.call_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  current_version_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_scripts TO authenticated;
GRANT ALL ON public.call_scripts TO service_role;
ALTER TABLE public.call_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scripts readable to authenticated"
  ON public.call_scripts FOR SELECT TO authenticated USING (true);
CREATE POLICY "scripts manageable by team_leader+"
  ON public.call_scripts FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid()) >= 2)
  WITH CHECK (public.max_role_level(auth.uid()) >= 2);
CREATE TRIGGER trg_call_scripts_touch BEFORE UPDATE ON public.call_scripts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.call_script_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES public.call_scripts(id) ON DELETE CASCADE,
  version INT NOT NULL,
  status public.script_status NOT NULL DEFAULT 'draft',
  tree JSONB NOT NULL DEFAULT '{}'::jsonb,
  changelog TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (script_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_script_versions TO authenticated;
GRANT ALL ON public.call_script_versions TO service_role;
ALTER TABLE public.call_script_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "script versions readable to authenticated"
  ON public.call_script_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "script versions writable by team_leader+"
  ON public.call_script_versions FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid()) >= 2)
  WITH CHECK (public.max_role_level(auth.uid()) >= 2);

ALTER TABLE public.call_scripts
  ADD CONSTRAINT call_scripts_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.call_script_versions(id) ON DELETE SET NULL;

CREATE TABLE public.script_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.call_script_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (version_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.script_acknowledgements TO authenticated;
GRANT ALL ON public.script_acknowledgements TO service_role;
ALTER TABLE public.script_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ack self read; leaders+ read all"
  ON public.script_acknowledgements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.max_role_level(auth.uid()) >= 2);
CREATE POLICY "ack write self"
  ON public.script_acknowledgements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ---------- QA scorecards ----------
CREATE TABLE public.qa_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  pass_threshold NUMERIC(5,2) NOT NULL DEFAULT 80,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_scorecards TO authenticated;
GRANT ALL ON public.qa_scorecards TO service_role;
ALTER TABLE public.qa_scorecards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scorecards readable to authenticated"
  ON public.qa_scorecards FOR SELECT TO authenticated USING (true);
CREATE POLICY "scorecards manageable by supervisors+"
  ON public.qa_scorecards FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid()) >= 3)
  WITH CHECK (public.max_role_level(auth.uid()) >= 3);
CREATE TRIGGER trg_qa_scorecards_touch BEFORE UPDATE ON public.qa_scorecards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.qa_scorecard_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id UUID NOT NULL REFERENCES public.qa_scorecards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_scorecard_sections TO authenticated;
GRANT ALL ON public.qa_scorecard_sections TO service_role;
ALTER TABLE public.qa_scorecard_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scorecard sections read"
  ON public.qa_scorecard_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "scorecard sections write supervisors+"
  ON public.qa_scorecard_sections FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid()) >= 3)
  WITH CHECK (public.max_role_level(auth.uid()) >= 3);

CREATE TABLE public.qa_scorecard_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.qa_scorecard_sections(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  weight NUMERIC(5,2) NOT NULL DEFAULT 1,
  max_score INT NOT NULL DEFAULT 5,
  is_critical BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_scorecard_items TO authenticated;
GRANT ALL ON public.qa_scorecard_items TO service_role;
ALTER TABLE public.qa_scorecard_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scorecard items read"
  ON public.qa_scorecard_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "scorecard items write supervisors+"
  ON public.qa_scorecard_items FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid()) >= 3)
  WITH CHECK (public.max_role_level(auth.uid()) >= 3);

CREATE TABLE public.qa_review_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  scorecard_id UUID REFERENCES public.qa_scorecards(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reviewer_id, call_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_review_assignments TO authenticated;
GRANT ALL ON public.qa_review_assignments TO service_role;
ALTER TABLE public.qa_review_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qa assignments reviewer self; leaders+ all"
  ON public.qa_review_assignments FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR public.max_role_level(auth.uid()) >= 2);
CREATE POLICY "qa assignments write supervisors+"
  ON public.qa_review_assignments FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid()) >= 3)
  WITH CHECK (public.max_role_level(auth.uid()) >= 3);
CREATE TRIGGER trg_qa_assignments_touch BEFORE UPDATE ON public.qa_review_assignments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.qa_coaching_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.qa_reviews(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_coaching_notes TO authenticated;
GRANT ALL ON public.qa_coaching_notes TO service_role;
ALTER TABLE public.qa_coaching_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaching notes readable to reviewed agent or leaders+"
  ON public.qa_coaching_notes FOR SELECT TO authenticated
  USING (
    public.max_role_level(auth.uid()) >= 2
    OR EXISTS (SELECT 1 FROM public.qa_reviews r JOIN public.calls c ON c.id = r.call_id
               WHERE r.id = review_id AND c.agent_id = auth.uid())
  );
CREATE POLICY "coaching notes write team_leader+"
  ON public.qa_coaching_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.max_role_level(auth.uid()) >= 2);

CREATE TABLE public.qa_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.qa_reviews(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','upheld','rejected','withdrawn')),
  moderator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  moderator_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_disputes TO authenticated;
GRANT ALL ON public.qa_disputes TO service_role;
ALTER TABLE public.qa_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disputes read agent or leaders+"
  ON public.qa_disputes FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.max_role_level(auth.uid()) >= 2);
CREATE POLICY "disputes insert by agent self"
  ON public.qa_disputes FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());
CREATE POLICY "disputes update by moderator supervisors+"
  ON public.qa_disputes FOR UPDATE TO authenticated
  USING (public.max_role_level(auth.uid()) >= 3);
CREATE TRIGGER trg_qa_disputes_touch BEFORE UPDATE ON public.qa_disputes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.qa_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.qa_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_acknowledgements TO authenticated;
GRANT ALL ON public.qa_acknowledgements TO service_role;
ALTER TABLE public.qa_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ack readable to self or leaders+"
  ON public.qa_acknowledgements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.max_role_level(auth.uid()) >= 2);
CREATE POLICY "ack writable self"
  ON public.qa_acknowledgements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
