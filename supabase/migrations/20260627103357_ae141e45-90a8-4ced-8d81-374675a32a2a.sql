-- =====================================================================
-- Phase 2A — Tenancy, 5-role RBAC, sessions/security, audit foundation
-- =====================================================================

-- 1. Tenancy
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE INDEX teams_org_idx ON public.teams(organization_id);

CREATE TABLE public.team_members (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_leader boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX team_members_user_idx ON public.team_members(user_id);

-- 2. Drop policies that reference has_role (public + storage), then drop has_role
DROP POLICY IF EXISTS "calls: agent or manager read"           ON public.calls;
DROP POLICY IF EXISTS "contacts: owner or manager can read"    ON public.contacts;
DROP POLICY IF EXISTS "criteria: manager delete"               ON public.qa_criteria;
DROP POLICY IF EXISTS "criteria: manager insert"               ON public.qa_criteria;
DROP POLICY IF EXISTS "criteria: manager update"               ON public.qa_criteria;
DROP POLICY IF EXISTS "scores: manager delete"                 ON public.qa_review_scores;
DROP POLICY IF EXISTS "scores: manager insert"                 ON public.qa_review_scores;
DROP POLICY IF EXISTS "scores: manager or own-call agent read" ON public.qa_review_scores;
DROP POLICY IF EXISTS "scores: manager update"                 ON public.qa_review_scores;
DROP POLICY IF EXISTS "reviews: manager delete"                ON public.qa_reviews;
DROP POLICY IF EXISTS "reviews: manager insert"                ON public.qa_reviews;
DROP POLICY IF EXISTS "reviews: manager or own-call agent read" ON public.qa_reviews;
DROP POLICY IF EXISTS "reviews: manager update"                ON public.qa_reviews;
DROP POLICY IF EXISTS "recordings: agent read own"             ON storage.objects;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 3. Swap enum
ALTER TYPE public.app_role RENAME TO app_role_v1;
CREATE TYPE public.app_role AS ENUM ('agent','team_leader','supervisor','ops_admin','super_admin');
ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role
  USING (CASE role::text WHEN 'manager' THEN 'supervisor' ELSE role::text END)::public.app_role;
DROP TYPE public.app_role_v1;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role) $$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 4. user_roles: add org/team scoping
ALTER TABLE public.user_roles
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN team_id         uuid REFERENCES public.teams(id)         ON DELETE SET NULL,
  ADD COLUMN granted_by      uuid REFERENCES auth.users(id),
  ADD COLUMN granted_at      timestamptz NOT NULL DEFAULT now();

-- 5. Permissions catalogue
CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions: any authenticated read" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions: super_admin writes" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.role_permissions(role, permission) VALUES
  ('agent','calls:create_own'),('agent','calls:read_own'),('agent','contacts:read_own'),
  ('agent','contacts:write_own'),('agent','availability:set_own'),('agent','qa:read_own'),
  ('agent','dashboard:view'),
  ('team_leader','calls:read_team'),('team_leader','qa:review_team'),
  ('team_leader','availability:read_team'),('team_leader','team:read'),
  ('team_leader','coaching:write_team'),
  ('supervisor','calls:read_org'),('supervisor','qa:review_org'),('supervisor','qa:criteria_write'),
  ('supervisor','campaigns:read'),('supervisor','campaigns:write'),
  ('supervisor','reports:read'),('supervisor','live_ops:view'),
  ('ops_admin','staff:create'),('ops_admin','staff:edit'),('ops_admin','staff:suspend'),
  ('ops_admin','staff:delete'),('ops_admin','teams:write'),('ops_admin','roles:assign'),
  ('ops_admin','dispositions:write'),('ops_admin','ip_allowlist:write'),
  ('ops_admin','sso:write'),('ops_admin','audit:read'),
  ('super_admin','organizations:write'),('super_admin','permissions:edit'),
  ('super_admin','impersonate'),('super_admin','platform:admin');

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH rank(role,lvl) AS (VALUES
    ('agent'::public.app_role,1),('team_leader',2),('supervisor',3),('ops_admin',4),('super_admin',5))
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
      JOIN rank ur_r ON ur_r.role=ur.role
      JOIN public.role_permissions rp ON true
      JOIN rank rp_r ON rp_r.role=rp.role
    WHERE ur.user_id=_user_id AND rp.permission=_permission AND ur_r.lvl>=rp_r.lvl)
$$;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid,text) FROM public;
GRANT  EXECUTE ON FUNCTION public.has_permission(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.max_role_level(_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH rank(role,lvl) AS (VALUES
    ('agent'::public.app_role,1),('team_leader',2),('supervisor',3),('ops_admin',4),('super_admin',5))
  SELECT COALESCE(MAX(r.lvl),0) FROM public.user_roles ur JOIN rank r ON r.role=ur.role
  WHERE ur.user_id=_user_id
$$;
REVOKE EXECUTE ON FUNCTION public.max_role_level(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.max_role_level(uuid) TO authenticated, service_role;

-- 6. Profile extensions
ALTER TABLE public.profiles
  ADD COLUMN staff_id text UNIQUE,
  ADD COLUMN username text UNIQUE,
  ADD COLUMN phone text,
  ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN avatar_url text,
  ADD COLUMN working_hours jsonb NOT NULL DEFAULT
    '{"mon":["09:00","17:00"],"tue":["09:00","17:00"],"wed":["09:00","17:00"],"thu":["09:00","17:00"],"fri":["09:00","17:00"]}'::jsonb,
  ADD COLUMN timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- 7. Agent availability
CREATE TYPE public.agent_presence AS ENUM
  ('available','on_call','acw','break','training','meeting','offline');

CREATE TABLE public.agent_availability (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.agent_presence NOT NULL DEFAULT 'offline',
  note text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.agent_availability TO authenticated;
GRANT ALL ON public.agent_availability TO service_role;
ALTER TABLE public.agent_availability ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.agent_availability_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.agent_presence NOT NULL,
  note text,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.agent_availability_log TO authenticated;
GRANT ALL ON public.agent_availability_log TO service_role;
ALTER TABLE public.agent_availability_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX availability_log_user_at_idx ON public.agent_availability_log(user_id, at DESC);

CREATE OR REPLACE FUNCTION public.log_agent_availability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.agent_availability_log(user_id,status,note)
  VALUES (NEW.user_id, NEW.status, NEW.note);
  RETURN NEW;
END $$;
CREATE TRIGGER agent_availability_log_trg
AFTER INSERT OR UPDATE OF status ON public.agent_availability
FOR EACH ROW EXECUTE FUNCTION public.log_agent_availability();

-- 8. Security tables
CREATE TABLE public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint text NOT NULL,
  label text, user_agent text,
  trusted boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_ip inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_fingerprint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  identifier text, ip inet, user_agent text,
  device_id uuid REFERENCES public.user_devices(id) ON DELETE SET NULL,
  country text,
  success boolean NOT NULL,
  reason text,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.login_history TO authenticated;
GRANT ALL ON public.login_history TO service_role;
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX login_history_user_at_idx ON public.login_history(user_id, at DESC);
CREATE INDEX login_history_id_at_idx   ON public.login_history(identifier, at DESC);

CREATE TABLE public.failed_login_attempts (
  id bigserial PRIMARY KEY,
  identifier text NOT NULL, ip inet,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.failed_login_attempts TO authenticated;
GRANT ALL ON public.failed_login_attempts TO service_role;
ALTER TABLE public.failed_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX fla_identifier_at_idx ON public.failed_login_attempts(identifier, at DESC);

CREATE TABLE public.account_suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  suspended_by uuid REFERENCES auth.users(id),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  lifted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.account_suspensions TO authenticated;
GRANT ALL ON public.account_suspensions TO service_role;
ALTER TABLE public.account_suspensions ENABLE ROW LEVEL SECURITY;
CREATE INDEX suspensions_user_idx ON public.account_suspensions(user_id);

CREATE OR REPLACE FUNCTION public.is_account_suspended(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.account_suspensions
    WHERE user_id=_user_id AND lifted_at IS NULL
      AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now()))
$$;
REVOKE EXECUTE ON FUNCTION public.is_account_suspended(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.is_account_suspended(uuid) TO authenticated, service_role;

CREATE TABLE public.two_factor_secrets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_encrypted text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  enrolled_at timestamptz, last_used_at timestamptz,
  backup_codes_hashed text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.two_factor_secrets TO service_role;
ALTER TABLE public.two_factor_secrets ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ip_allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  cidr cidr NOT NULL, label text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ip_allowlist TO authenticated;
GRANT ALL ON public.ip_allowlist TO service_role;
ALTER TABLE public.ip_allowlist ENABLE ROW LEVEL SECURITY;
CREATE INDEX ip_allowlist_org_idx ON public.ip_allowlist(organization_id);

CREATE TABLE public.sso_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL, display_name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sso_providers TO authenticated;
GRANT ALL ON public.sso_providers TO service_role;
ALTER TABLE public.sso_providers ENABLE ROW LEVEL SECURITY;

-- 9. Audit log
CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  action text NOT NULL, target_type text, target_id text,
  diff jsonb, ip inet, user_agent text,
  at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX audit_log_org_at_idx    ON public.audit_log(organization_id, at DESC);
CREATE INDEX audit_log_actor_at_idx  ON public.audit_log(actor_id, at DESC);
CREATE INDEX audit_log_action_at_idx ON public.audit_log(action, at DESC);

CREATE OR REPLACE FUNCTION public.record_audit(
  _actor uuid, _org uuid, _action text,
  _target_type text, _target_id text, _diff jsonb, _ip inet, _ua text
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO public.audit_log(actor_id,organization_id,action,target_type,target_id,diff,ip,user_agent)
  VALUES (_actor,_org,_action,_target_type,_target_id,_diff,_ip,_ua);
$$;
REVOKE EXECUTE ON FUNCTION public.record_audit(uuid,uuid,text,text,text,jsonb,inet,text) FROM public;
GRANT  EXECUTE ON FUNCTION public.record_audit(uuid,uuid,text,text,text,jsonb,inet,text) TO authenticated, service_role;

-- 10. RLS on new tables
CREATE POLICY "orgs: read for authenticated" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "orgs: super_admin manage" ON public.organizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "teams: read" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams: ops_admin write" ON public.teams FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid())>=4) WITH CHECK (public.max_role_level(auth.uid())>=4);

CREATE POLICY "team_members: read" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "team_members: ops_admin write" ON public.team_members FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid())>=4) WITH CHECK (public.max_role_level(auth.uid())>=4);

CREATE POLICY "availability: read self or leader+" ON public.agent_availability FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.max_role_level(auth.uid())>=2);
CREATE POLICY "availability: self insert" ON public.agent_availability FOR INSERT TO authenticated
  WITH CHECK (user_id=auth.uid());
CREATE POLICY "availability: self update" ON public.agent_availability FOR UPDATE TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

CREATE POLICY "availability_log: read self or leader+" ON public.agent_availability_log FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.max_role_level(auth.uid())>=2);
CREATE POLICY "availability_log: no client insert" ON public.agent_availability_log FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "devices: owner or ops read" ON public.user_devices FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.max_role_level(auth.uid())>=4);
CREATE POLICY "devices: owner write" ON public.user_devices FOR ALL TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

CREATE POLICY "login_history: owner or ops read" ON public.login_history FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.max_role_level(auth.uid())>=4);
CREATE POLICY "login_history: no client insert" ON public.login_history FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "fla: ops_admin read" ON public.failed_login_attempts FOR SELECT TO authenticated
  USING (public.max_role_level(auth.uid())>=4);
CREATE POLICY "fla: no client insert" ON public.failed_login_attempts FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "fla: ops_admin delete" ON public.failed_login_attempts FOR DELETE TO authenticated
  USING (public.max_role_level(auth.uid())>=4);

CREATE POLICY "susp: subject or ops read" ON public.account_suspensions FOR SELECT TO authenticated
  USING (user_id=auth.uid() OR public.max_role_level(auth.uid())>=4);
CREATE POLICY "susp: ops_admin write" ON public.account_suspensions FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid())>=4) WITH CHECK (public.max_role_level(auth.uid())>=4);

CREATE POLICY "ipal: ops_admin read" ON public.ip_allowlist FOR SELECT TO authenticated
  USING (public.max_role_level(auth.uid())>=4);
CREATE POLICY "ipal: ops_admin write" ON public.ip_allowlist FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid())>=4) WITH CHECK (public.max_role_level(auth.uid())>=4);

CREATE POLICY "sso: ops_admin read" ON public.sso_providers FOR SELECT TO authenticated
  USING (public.max_role_level(auth.uid())>=4);
CREATE POLICY "sso: ops_admin write" ON public.sso_providers FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid())>=4) WITH CHECK (public.max_role_level(auth.uid())>=4);

CREATE POLICY "audit: ops_admin read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.max_role_level(auth.uid())>=4);
CREATE POLICY "audit: no client insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (false);

-- 11. Recreate policies on existing tables with new role hierarchy
CREATE POLICY "calls: agent self or supervisor+ read" ON public.calls FOR SELECT TO authenticated
  USING (agent_id=auth.uid() OR public.max_role_level(auth.uid())>=3);

CREATE POLICY "contacts: owner or supervisor+ read" ON public.contacts FOR SELECT TO authenticated
  USING (owner_id=auth.uid() OR public.max_role_level(auth.uid())>=3);

CREATE POLICY "criteria: supervisor+ insert" ON public.qa_criteria FOR INSERT TO authenticated
  WITH CHECK (public.max_role_level(auth.uid())>=3);
CREATE POLICY "criteria: supervisor+ update" ON public.qa_criteria FOR UPDATE TO authenticated
  USING (public.max_role_level(auth.uid())>=3);
CREATE POLICY "criteria: supervisor+ delete" ON public.qa_criteria FOR DELETE TO authenticated
  USING (public.max_role_level(auth.uid())>=3);

CREATE POLICY "reviews: team_leader+ insert" ON public.qa_reviews FOR INSERT TO authenticated
  WITH CHECK (public.max_role_level(auth.uid())>=2 AND reviewer_id=auth.uid());
CREATE POLICY "reviews: team_leader+ or own-call read" ON public.qa_reviews FOR SELECT TO authenticated
  USING (public.max_role_level(auth.uid())>=2
         OR EXISTS (SELECT 1 FROM public.calls c WHERE c.id=qa_reviews.call_id AND c.agent_id=auth.uid()));
CREATE POLICY "reviews: team_leader+ update" ON public.qa_reviews FOR UPDATE TO authenticated
  USING (public.max_role_level(auth.uid())>=2);
CREATE POLICY "reviews: supervisor+ delete" ON public.qa_reviews FOR DELETE TO authenticated
  USING (public.max_role_level(auth.uid())>=3);

CREATE POLICY "scores: team_leader+ insert" ON public.qa_review_scores FOR INSERT TO authenticated
  WITH CHECK (public.max_role_level(auth.uid())>=2);
CREATE POLICY "scores: team_leader+ or own-call agent read" ON public.qa_review_scores FOR SELECT TO authenticated
  USING (public.max_role_level(auth.uid())>=2
         OR EXISTS (SELECT 1 FROM public.qa_reviews r JOIN public.calls c ON c.id=r.call_id
                     WHERE r.id=qa_review_scores.review_id AND c.agent_id=auth.uid()));
CREATE POLICY "scores: team_leader+ update" ON public.qa_review_scores FOR UPDATE TO authenticated
  USING (public.max_role_level(auth.uid())>=2);
CREATE POLICY "scores: supervisor+ delete" ON public.qa_review_scores FOR DELETE TO authenticated
  USING (public.max_role_level(auth.uid())>=3);

-- Recreate storage policy with new role hierarchy
CREATE POLICY "recordings: agent read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='call-recordings'
         AND ((storage.foldername(name))[1]=(auth.uid())::text
              OR public.max_role_level(auth.uid())>=3));

-- 12. Updated signup trigger (still defaults to agent, attaches default org)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE default_org uuid;
BEGIN
  SELECT id INTO default_org FROM public.organizations WHERE slug='default' LIMIT 1;
  INSERT INTO public.profiles (id,full_name,organization_id)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), default_org);
  INSERT INTO public.user_roles (user_id,role,organization_id)
    VALUES (NEW.id,'agent',default_org);
  INSERT INTO public.agent_availability (user_id,status) VALUES (NEW.id,'offline');
  RETURN NEW;
END $$;

-- 13. updated_at touch triggers
CREATE TRIGGER orgs_touch     BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER teams_touch    BEFORE UPDATE ON public.teams         FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER sso_touch      BEFORE UPDATE ON public.sso_providers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 14. Seed default org + backfill
INSERT INTO public.organizations (name,slug) VALUES ('Default Organization','default');
UPDATE public.profiles    SET organization_id=(SELECT id FROM public.organizations WHERE slug='default') WHERE organization_id IS NULL;
UPDATE public.user_roles  SET organization_id=(SELECT id FROM public.organizations WHERE slug='default') WHERE organization_id IS NULL;
INSERT INTO public.teams (organization_id,name)
  SELECT id,'Operations' FROM public.organizations WHERE slug='default';
INSERT INTO public.agent_availability (user_id,status)
  SELECT id,'offline' FROM auth.users
  ON CONFLICT (user_id) DO NOTHING;