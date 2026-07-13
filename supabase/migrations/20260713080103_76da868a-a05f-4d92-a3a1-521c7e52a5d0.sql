
-- 1. Fix search_path on is_valid_client_transition
CREATE OR REPLACE FUNCTION public.is_valid_client_transition(_from client_status, _to client_status)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
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
$function$;

-- 2. Revoke EXECUTE from PUBLIC/anon on all SECURITY DEFINER functions in public.
-- Keep authenticated EXECUTE only on the helpers RLS policies actually call.
REVOKE ALL ON FUNCTION public.recompute_review_score() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify(uuid, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_task_assigned() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_complaint() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_audit(uuid, uuid, text, text, text, jsonb, inet, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_client_status_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_agent_availability() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_permission_catalog() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_call_disposition_campaign() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- RLS helper functions: revoke from PUBLIC/anon, keep authenticated so RLS
-- policies can evaluate them for signed-in users.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.max_role_level(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_account_suspended(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_team_leader_of(uuid, uuid) FROM PUBLIC, anon;

-- 3. RLS policy always-true finding: tasks insert
DROP POLICY IF EXISTS "task insert by authenticated" ON public.tasks;
CREATE POLICY "tasks: insert by creator or team leader"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR has_permission(auth.uid(), 'staff:view_team'::text)
  );

-- 4. call_review_tags: scope read to calls the user can see
DROP POLICY IF EXISTS review_tags_read ON public.call_review_tags;
CREATE POLICY review_tags_read
  ON public.call_review_tags
  FOR SELECT
  TO authenticated
  USING (
    call_id IN (
      SELECT c.id FROM public.calls c
      WHERE c.agent_id = auth.uid()
         OR has_permission(auth.uid(), 'staff:view_all'::text)
         OR (c.team_id IS NOT NULL AND c.team_id IN (
              SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
            ) AND has_permission(auth.uid(), 'staff:view_team'::text))
         OR (c.team_id IS NOT NULL AND is_team_leader_of(auth.uid(), c.team_id))
         OR max_role_level(auth.uid()) >= 3
    )
  );

-- 5. call_transfers: same scope
DROP POLICY IF EXISTS transfers_read ON public.call_transfers;
CREATE POLICY transfers_read
  ON public.call_transfers
  FOR SELECT
  TO authenticated
  USING (
    call_id IN (
      SELECT c.id FROM public.calls c
      WHERE c.agent_id = auth.uid()
         OR has_permission(auth.uid(), 'staff:view_all'::text)
         OR (c.team_id IS NOT NULL AND c.team_id IN (
              SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
            ) AND has_permission(auth.uid(), 'staff:view_team'::text))
         OR (c.team_id IS NOT NULL AND is_team_leader_of(auth.uid(), c.team_id))
         OR max_role_level(auth.uid()) >= 3
    )
  );

-- Shared client-scope predicate reused in policies below:
--   scoped if contact.owner_id = me OR assigned_agent_id = me
--   OR (team_leader/supervisor+) OR assigned_team_id in my teams

-- 6. client_consents: scope read
DROP POLICY IF EXISTS consents_read_signed_in ON public.client_consents;
CREATE POLICY consents_read_scoped
  ON public.client_consents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = client_consents.client_id
        AND c.deleted_at IS NULL
        AND (
          c.owner_id = auth.uid()
          OR c.assigned_agent_id = auth.uid()
          OR (max_role_level(auth.uid()) >= 2 AND c.assigned_team_id IN (
                SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
              ))
          OR max_role_level(auth.uid()) >= 3
          OR has_permission(auth.uid(), 'clients:view'::text)
        )
    )
  );

-- 7. client_contact_methods: scope read
DROP POLICY IF EXISTS ccm_read_signed_in ON public.client_contact_methods;
CREATE POLICY ccm_read_scoped
  ON public.client_contact_methods
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = client_contact_methods.client_id
        AND c.deleted_at IS NULL
        AND (
          c.owner_id = auth.uid()
          OR c.assigned_agent_id = auth.uid()
          OR (max_role_level(auth.uid()) >= 2 AND c.assigned_team_id IN (
                SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
              ))
          OR max_role_level(auth.uid()) >= 3
          OR has_permission(auth.uid(), 'clients:view'::text)
        )
    )
  );

-- 8. client_documents: scope read
DROP POLICY IF EXISTS "docs: read for client viewers" ON public.client_documents;
CREATE POLICY "docs: read for client viewers"
  ON public.client_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = client_documents.client_id
        AND c.deleted_at IS NULL
        AND (
          c.owner_id = auth.uid()
          OR c.assigned_agent_id = auth.uid()
          OR (max_role_level(auth.uid()) >= 2 AND c.assigned_team_id IN (
                SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
              ))
          OR max_role_level(auth.uid()) >= 3
          OR has_permission(auth.uid(), 'clients:view'::text)
        )
    )
  );

-- 9. client_status_transitions: scope read
DROP POLICY IF EXISTS "transitions: read for client viewers" ON public.client_status_transitions;
CREATE POLICY "transitions: read for client viewers"
  ON public.client_status_transitions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = client_status_transitions.client_id
        AND c.deleted_at IS NULL
        AND (
          c.owner_id = auth.uid()
          OR c.assigned_agent_id = auth.uid()
          OR (max_role_level(auth.uid()) >= 2 AND c.assigned_team_id IN (
                SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid()
              ))
          OR max_role_level(auth.uid()) >= 3
          OR has_permission(auth.uid(), 'clients:view'::text)
        )
    )
  );

-- 10. custom_roles / custom_role_permissions: scope read to same organization
DROP POLICY IF EXISTS "Anyone signed in can read custom roles" ON public.custom_roles;
CREATE POLICY "custom_roles: read same org"
  ON public.custom_roles
  FOR SELECT
  TO authenticated
  USING (
    organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "Anyone signed in can read custom role permissions" ON public.custom_role_permissions;
CREATE POLICY "custom_role_permissions: read same org"
  ON public.custom_role_permissions
  FOR SELECT
  TO authenticated
  USING (
    role_id IN (
      SELECT cr.id FROM public.custom_roles cr
      WHERE cr.organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );

-- 11. notifications insert: restrict to self or staff managers
DROP POLICY IF EXISTS "managers can insert notifications" ON public.notifications;
CREATE POLICY "notifications: insert self or manager"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR has_permission(auth.uid(), 'staff:view_team'::text)
    OR max_role_level(auth.uid()) >= 3
  );

-- 12. profiles read: scope to same organization or self
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles: read same org or self"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 13. user_roles: split manage policy to prevent privilege escalation
DROP POLICY IF EXISTS "user_roles: ops_admin manage" ON public.user_roles;

CREATE POLICY "user_roles: grant below own level"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    max_role_level(auth.uid()) >= 4
    AND (
      -- super_admin can grant anything
      has_role(auth.uid(), 'super_admin'::app_role)
      OR
      -- ops_admin can grant strictly below their own level (i.e. not ops_admin or super_admin)
      (CASE role
        WHEN 'agent'::app_role THEN 1
        WHEN 'team_leader'::app_role THEN 2
        WHEN 'supervisor'::app_role THEN 3
        WHEN 'ops_admin'::app_role THEN 4
        WHEN 'super_admin'::app_role THEN 5
      END) < max_role_level(auth.uid())
    )
  );

CREATE POLICY "user_roles: update below own level"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (
    max_role_level(auth.uid()) >= 4
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR (CASE role
            WHEN 'agent'::app_role THEN 1
            WHEN 'team_leader'::app_role THEN 2
            WHEN 'supervisor'::app_role THEN 3
            WHEN 'ops_admin'::app_role THEN 4
            WHEN 'super_admin'::app_role THEN 5
          END) < max_role_level(auth.uid())
    )
  )
  WITH CHECK (
    max_role_level(auth.uid()) >= 4
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR (CASE role
            WHEN 'agent'::app_role THEN 1
            WHEN 'team_leader'::app_role THEN 2
            WHEN 'supervisor'::app_role THEN 3
            WHEN 'ops_admin'::app_role THEN 4
            WHEN 'super_admin'::app_role THEN 5
          END) < max_role_level(auth.uid())
    )
  );

CREATE POLICY "user_roles: revoke below own level, no self super_admin removal"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    max_role_level(auth.uid()) >= 4
    AND user_id <> auth.uid()  -- cannot revoke your own roles via RLS
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR (CASE role
            WHEN 'agent'::app_role THEN 1
            WHEN 'team_leader'::app_role THEN 2
            WHEN 'supervisor'::app_role THEN 3
            WHEN 'ops_admin'::app_role THEN 4
            WHEN 'super_admin'::app_role THEN 5
          END) < max_role_level(auth.uid())
    )
  );
