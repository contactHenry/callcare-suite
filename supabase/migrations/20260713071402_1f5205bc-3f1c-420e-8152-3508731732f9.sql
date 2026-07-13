
-- Enums
DO $$ BEGIN
  CREATE TYPE public.support_ticket_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_ticket_status AS ENUM ('open','in_progress','waiting','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.support_ticket_category AS ENUM ('bug','feature_request','billing','account','integration','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tickets
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category public.support_ticket_category NOT NULL DEFAULT 'other',
  priority public.support_ticket_priority NOT NULL DEFAULT 'normal',
  status public.support_ticket_status NOT NULL DEFAULT 'open',
  screenshot_path TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX support_tickets_created_by_idx ON public.support_tickets(created_by);
CREATE INDEX support_tickets_org_idx ON public.support_tickets(organization_id);
CREATE INDEX support_tickets_status_idx ON public.support_tickets(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Admins view org tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(),'ops_admin') OR public.has_role(auth.uid(),'super_admin'))
    AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users create tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users update own open tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND status IN ('open','waiting'))
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins update org tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(),'ops_admin') OR public.has_role(auth.uid(),'super_admin'))
    AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE TRIGGER support_tickets_touch
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Comments
CREATE TABLE public.support_ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_staff_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX support_ticket_comments_ticket_idx ON public.support_ticket_comments(ticket_id);

GRANT SELECT, INSERT ON public.support_ticket_comments TO authenticated;
GRANT ALL ON public.support_ticket_comments TO service_role;

ALTER TABLE public.support_ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comments on visible tickets" ON public.support_ticket_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_ticket_comments.ticket_id
      AND (
        t.created_by = auth.uid()
        OR (
          (public.has_role(auth.uid(),'ops_admin') OR public.has_role(auth.uid(),'super_admin'))
          AND t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
      )
  ));

CREATE POLICY "Add comments on visible tickets" ON public.support_ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_comments.ticket_id
        AND (
          t.created_by = auth.uid()
          OR (
            (public.has_role(auth.uid(),'ops_admin') OR public.has_role(auth.uid(),'super_admin'))
            AND t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
          )
        )
    )
  );

-- Storage policies on support-attachments bucket
-- Path convention: <ticket_id>/<filename>
CREATE POLICY "Support attachments: owner or admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id::text = split_part(storage.objects.name, '/', 1)
        AND (
          t.created_by = auth.uid()
          OR (
            (public.has_role(auth.uid(),'ops_admin') OR public.has_role(auth.uid(),'super_admin'))
            AND t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
          )
        )
    )
  );

CREATE POLICY "Support attachments: authenticated insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments' AND owner = auth.uid());

CREATE POLICY "Support attachments: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'support-attachments' AND owner = auth.uid());
