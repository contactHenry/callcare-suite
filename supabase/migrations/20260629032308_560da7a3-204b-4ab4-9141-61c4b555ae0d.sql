
CREATE OR REPLACE FUNCTION public.audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % operations are not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;
