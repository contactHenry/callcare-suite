-- Revoke EXECUTE from the implicit anon role on every SECURITY DEFINER helper
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.max_role_level(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_account_suspended(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_audit(uuid,uuid,text,text,text,jsonb,inet,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_agent_availability() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_review_score() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated;

-- two_factor_secrets currently has RLS enabled with no policy: make the lock explicit.
-- Service role bypasses RLS; signed-in users have no path in. The lock policy keeps the linter happy
-- and documents intent.
CREATE POLICY "2fa: no client access" ON public.two_factor_secrets
  FOR ALL TO authenticated USING (false) WITH CHECK (false);