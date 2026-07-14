
-- ========== subscription_plans ==========
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  price_monthly numeric(10,2) NOT NULL,
  price_annual numeric(10,2),
  max_users int,
  max_teams int,
  storage_gb int,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_popular boolean NOT NULL DEFAULT false,
  is_enterprise boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans readable by authenticated users"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (active = true OR public.has_role(auth.uid(), 'super_admin'));

-- ========== org_subscriptions ==========
-- Note: existing tenant table is `organizations` (US spelling); referencing that.
CREATE TABLE public.org_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid UNIQUE NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial','active','past_due','cancelled','paused')),
  billing_cycle text NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly','annual')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  stripe_subscription_id text,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.org_subscriptions TO authenticated;
GRANT ALL ON public.org_subscriptions TO service_role;
ALTER TABLE public.org_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own org subscription"
  ON public.org_subscriptions FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Ops admins update own org subscription"
  ON public.org_subscriptions FOR UPDATE TO authenticated
  USING (
    (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
     AND (public.has_role(auth.uid(), 'ops_admin') OR public.has_role(auth.uid(), 'super_admin')))
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    (org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
     AND (public.has_role(auth.uid(), 'ops_admin') OR public.has_role(auth.uid(), 'super_admin')))
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER trg_org_subscriptions_updated_at
  BEFORE UPDATE ON public.org_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== subscription_events ==========
CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN (
      'plan_activated','plan_upgraded','plan_downgraded','plan_cancelled',
      'trial_started','trial_converted','payment_succeeded','payment_failed',
      'plan_paused','plan_resumed'
    )),
  from_plan_id uuid REFERENCES public.subscription_plans(id),
  to_plan_id uuid REFERENCES public.subscription_plans(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own org events"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (
    org_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE INDEX idx_subscription_events_org ON public.subscription_events(org_id, created_at DESC);

-- ========== seed the five plans ==========
INSERT INTO public.subscription_plans
  (name, slug, price_monthly, price_annual, max_users, max_teams, storage_gb, is_popular, is_enterprise, sort_order, features)
VALUES
('Starter','starter',59.00,602.00,3,1,5,false,false,1,'{
  "call_recording":false,"call_recording_review":false,"live_monitoring":false,"whisper_barge_takeover":false,
  "qa_scorecards":false,"campaign_management":false,"advanced_reporting":false,"compliance_centre":false,
  "audit_logs":false,"workflow_automation":false,"crm_integrations":false,"multi_department":false,
  "sso":false,"advanced_roles":false,"white_label":false,"multi_site":false,"api_access":false,
  "custom_integrations":false,"dedicated_infrastructure":false,
  "task_management":true,"follow_up_scheduling":true,"client_management":true,
  "inbound_outbound_calling":true,"click_to_call":true,"call_notes_outcomes":true,"basic_dashboard":true
}'::jsonb),
('Growth','growth',199.00,2030.00,10,3,50,false,false,2,'{
  "call_recording":true,"call_recording_review":true,"live_monitoring":false,"whisper_barge_takeover":false,
  "qa_scorecards":true,"campaign_management":true,"advanced_reporting":false,"compliance_centre":false,
  "audit_logs":false,"workflow_automation":false,"crm_integrations":false,"multi_department":false,
  "sso":false,"advanced_roles":false,"white_label":false,"multi_site":false,"api_access":true,
  "custom_integrations":false,"dedicated_infrastructure":false,
  "task_management":true,"follow_up_scheduling":true,"client_management":true,
  "inbound_outbound_calling":true,"click_to_call":true,"call_notes_outcomes":true,"basic_dashboard":true
}'::jsonb),
('Professional','professional',599.00,6110.00,30,NULL,250,true,false,3,'{
  "call_recording":true,"call_recording_review":true,"live_monitoring":true,"whisper_barge_takeover":true,
  "qa_scorecards":true,"campaign_management":true,"advanced_reporting":true,"compliance_centre":true,
  "audit_logs":true,"workflow_automation":true,"crm_integrations":true,"multi_department":true,
  "sso":false,"advanced_roles":false,"white_label":false,"multi_site":false,"api_access":true,
  "custom_integrations":false,"dedicated_infrastructure":false,
  "task_management":true,"follow_up_scheduling":true,"client_management":true,
  "inbound_outbound_calling":true,"click_to_call":true,"call_notes_outcomes":true,"basic_dashboard":true
}'::jsonb),
('Business','business',1499.00,15290.00,100,NULL,1000,false,false,4,'{
  "call_recording":true,"call_recording_review":true,"live_monitoring":true,"whisper_barge_takeover":true,
  "qa_scorecards":true,"campaign_management":true,"advanced_reporting":true,"compliance_centre":true,
  "audit_logs":true,"workflow_automation":true,"crm_integrations":true,"multi_department":true,
  "sso":true,"advanced_roles":true,"white_label":true,"multi_site":true,"api_access":true,
  "custom_integrations":false,"dedicated_infrastructure":false,
  "task_management":true,"follow_up_scheduling":true,"client_management":true,
  "inbound_outbound_calling":true,"click_to_call":true,"call_notes_outcomes":true,"basic_dashboard":true
}'::jsonb),
('Enterprise','enterprise',3500.00,NULL,NULL,NULL,NULL,false,true,5,'{
  "call_recording":true,"call_recording_review":true,"live_monitoring":true,"whisper_barge_takeover":true,
  "qa_scorecards":true,"campaign_management":true,"advanced_reporting":true,"compliance_centre":true,
  "audit_logs":true,"workflow_automation":true,"crm_integrations":true,"multi_department":true,
  "sso":true,"advanced_roles":true,"white_label":true,"multi_site":true,"api_access":true,
  "custom_integrations":true,"dedicated_infrastructure":true,
  "task_management":true,"follow_up_scheduling":true,"client_management":true,
  "inbound_outbound_calling":true,"click_to_call":true,"call_notes_outcomes":true,"basic_dashboard":true
}'::jsonb);
