-- Ops admins can manage role grants on user_roles
CREATE POLICY "user_roles: ops_admin manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.max_role_level(auth.uid()) >= 4)
  WITH CHECK (public.max_role_level(auth.uid()) >= 4);

-- Ops admins can update any profile (staff management)
CREATE POLICY "profiles: ops_admin update any" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.max_role_level(auth.uid()) >= 4)
  WITH CHECK (public.max_role_level(auth.uid()) >= 4);

-- Ops admins can read the full availability history log
CREATE POLICY "avail_log: ops read all" ON public.agent_availability_log
  FOR SELECT TO authenticated
  USING (public.max_role_level(auth.uid()) >= 4 OR user_id = auth.uid());