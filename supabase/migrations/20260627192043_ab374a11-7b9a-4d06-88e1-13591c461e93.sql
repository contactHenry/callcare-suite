
-- Custom roles defined by admins per organization
CREATE TABLE public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_roles TO authenticated;
GRANT ALL ON public.custom_roles TO service_role;
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read custom roles"
  ON public.custom_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage custom roles"
  ON public.custom_roles FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'roles:assign'))
  WITH CHECK (public.has_permission(auth.uid(), 'roles:assign'));

CREATE TRIGGER trg_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Permissions granted to a custom role
CREATE TABLE public.custom_role_permissions (
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  PRIMARY KEY (role_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_role_permissions TO authenticated;
GRANT ALL ON public.custom_role_permissions TO service_role;
ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read custom role permissions"
  ON public.custom_role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage custom role permissions"
  ON public.custom_role_permissions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'roles:assign'))
  WITH CHECK (public.has_permission(auth.uid(), 'roles:assign'));

-- Assignment of a custom role to a user
CREATE TABLE public.user_custom_role_assignments (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_custom_role_assignments TO authenticated;
GRANT ALL ON public.user_custom_role_assignments TO service_role;
ALTER TABLE public.user_custom_role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own custom role assignments, admins see all"
  ON public.user_custom_role_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'roles:assign'));
CREATE POLICY "Admins assign custom roles"
  ON public.user_custom_role_assignments FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'roles:assign'))
  WITH CHECK (public.has_permission(auth.uid(), 'roles:assign'));

-- Replace has_permission so custom-role grants are also honored.
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH rank(role,lvl) AS (VALUES
    ('agent'::public.app_role,1),('team_leader',2),('supervisor',3),('ops_admin',4),('super_admin',5))
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
        JOIN rank ur_r ON ur_r.role=ur.role
        JOIN public.role_permissions rp ON true
        JOIN rank rp_r ON rp_r.role=rp.role
      WHERE ur.user_id=_user_id AND rp.permission=_permission AND ur_r.lvl>=rp_r.lvl
    )
    OR EXISTS (
      SELECT 1 FROM public.user_custom_role_assignments uca
        JOIN public.custom_role_permissions crp ON crp.role_id = uca.role_id
      WHERE uca.user_id = _user_id AND crp.permission = _permission
    );
$$;

-- Catalog of all known permissions (derived from system role_permissions)
CREATE OR REPLACE FUNCTION public.list_permission_catalog()
RETURNS TABLE(permission TEXT)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT permission FROM public.role_permissions ORDER BY permission;
$$;
REVOKE EXECUTE ON FUNCTION public.list_permission_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_permission_catalog() TO authenticated;
