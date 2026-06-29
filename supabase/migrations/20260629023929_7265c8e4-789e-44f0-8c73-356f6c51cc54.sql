
CREATE TABLE public.client_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'selected',  -- 'all' | 'selected' | 'filtered'
  client_ids UUID[] NOT NULL DEFAULT '{}',
  filter_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  state TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'approved' | 'rejected' | 'cancelled'
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  delivered_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX client_export_requests_state_idx ON public.client_export_requests(state, created_at DESC);
CREATE INDEX client_export_requests_org_idx   ON public.client_export_requests(organization_id);
CREATE INDEX client_export_requests_user_idx  ON public.client_export_requests(requested_by);

GRANT SELECT, INSERT, UPDATE ON public.client_export_requests TO authenticated;
GRANT ALL ON public.client_export_requests TO service_role;

ALTER TABLE public.client_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters see their own export requests"
  ON public.client_export_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

CREATE POLICY "Approvers see export requests in their org"
  ON public.client_export_requests FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'clients:export'));

CREATE POLICY "Authenticated users may raise export requests"
  ON public.client_export_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

CREATE POLICY "Approvers decide export requests"
  ON public.client_export_requests FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(), 'clients:export'))
  WITH CHECK (public.has_permission(auth.uid(), 'clients:export'));

CREATE TRIGGER touch_client_export_requests
  BEFORE UPDATE ON public.client_export_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
