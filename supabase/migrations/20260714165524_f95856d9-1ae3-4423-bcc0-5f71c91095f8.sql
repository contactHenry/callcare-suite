
CREATE OR REPLACE FUNCTION public.current_user_org()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1 $$;

DROP POLICY IF EXISTS "profiles: read same org or self" ON public.profiles;
CREATE POLICY "profiles: read same org or self" ON public.profiles
FOR SELECT USING (id = auth.uid() OR organization_id = public.current_user_org());
