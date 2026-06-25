
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('agent','manager');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + default agent role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agent');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ CRM CONTACTS ============
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'lead',
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts: owner or manager can read" ON public.contacts FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "contacts: owner insert" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "contacts: owner update" ON public.contacts FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "contacts: owner delete" ON public.contacts FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- ============ CALLS ============
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL DEFAULT 'resolved',
  notes TEXT,
  audio_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "calls: agent or manager read" ON public.calls FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "calls: agent insert" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());
CREATE POLICY "calls: agent update own" ON public.calls FOR UPDATE TO authenticated
  USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());
CREATE POLICY "calls: agent delete own" ON public.calls FOR DELETE TO authenticated
  USING (agent_id = auth.uid());

-- ============ QA ============
CREATE TABLE public.qa_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  description TEXT,
  weight NUMERIC NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_criteria TO authenticated;
GRANT ALL ON public.qa_criteria TO service_role;
ALTER TABLE public.qa_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "criteria: all read" ON public.qa_criteria FOR SELECT TO authenticated USING (true);
CREATE POLICY "criteria: manager insert" ON public.qa_criteria FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'manager'));
CREATE POLICY "criteria: manager update" ON public.qa_criteria FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'manager'));
CREATE POLICY "criteria: manager delete" ON public.qa_criteria FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'manager'));

CREATE TABLE public.qa_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL UNIQUE REFERENCES public.calls(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_score NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_reviews TO authenticated;
GRANT ALL ON public.qa_reviews TO service_role;
ALTER TABLE public.qa_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews: manager or own-call agent read" ON public.qa_reviews FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'manager')
    OR EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND c.agent_id = auth.uid())
  );
CREATE POLICY "reviews: manager insert" ON public.qa_reviews FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'manager') AND reviewer_id = auth.uid());
CREATE POLICY "reviews: manager update" ON public.qa_reviews FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'manager'));
CREATE POLICY "reviews: manager delete" ON public.qa_reviews FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'manager'));

CREATE TABLE public.qa_review_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.qa_reviews(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES public.qa_criteria(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  UNIQUE (review_id, criterion_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_review_scores TO authenticated;
GRANT ALL ON public.qa_review_scores TO service_role;
ALTER TABLE public.qa_review_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores: manager or own-call agent read" ON public.qa_review_scores FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'manager')
    OR EXISTS (
      SELECT 1 FROM public.qa_reviews r
      JOIN public.calls c ON c.id = r.call_id
      WHERE r.id = review_id AND c.agent_id = auth.uid()
    )
  );
CREATE POLICY "scores: manager insert" ON public.qa_review_scores FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'manager'));
CREATE POLICY "scores: manager update" ON public.qa_review_scores FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'manager'));
CREATE POLICY "scores: manager delete" ON public.qa_review_scores FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'manager'));

-- Recompute overall_score on score changes
CREATE OR REPLACE FUNCTION public.recompute_review_score()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_review_id UUID;
  v_total NUMERIC;
  v_max NUMERIC;
BEGIN
  v_review_id := COALESCE(NEW.review_id, OLD.review_id);
  SELECT COALESCE(SUM(s.score * c.weight),0), COALESCE(SUM(5 * c.weight),0)
    INTO v_total, v_max
    FROM public.qa_review_scores s
    JOIN public.qa_criteria c ON c.id = s.criterion_id
    WHERE s.review_id = v_review_id;
  UPDATE public.qa_reviews
    SET overall_score = CASE WHEN v_max > 0 THEN ROUND((v_total / v_max) * 100, 1) ELSE NULL END,
        updated_at = now()
    WHERE id = v_review_id;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_recompute_review_score
AFTER INSERT OR UPDATE OR DELETE ON public.qa_review_scores
FOR EACH ROW EXECUTE FUNCTION public.recompute_review_score();

-- updated_at touch
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_contacts_touch BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed default criteria
INSERT INTO public.qa_criteria (label, description, weight) VALUES
  ('Greeting', 'Friendly, professional opening', 1),
  ('Tone & Empathy', 'Tone matches caller, shows empathy', 1.5),
  ('Resolution', 'Issue addressed or clear next steps', 2),
  ('Compliance', 'Followed required disclosures & scripts', 1.5);
