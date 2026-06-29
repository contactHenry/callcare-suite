
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS recording_retention_days integer NOT NULL DEFAULT 365,
  ADD COLUMN IF NOT EXISTS record_retention_days integer NOT NULL DEFAULT 2555,
  ADD COLUMN IF NOT EXISTS audit_retention_days integer NOT NULL DEFAULT 2555,
  ADD COLUMN IF NOT EXISTS contact_hours_start time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS contact_hours_end time NOT NULL DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS contact_hours_timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS contact_days int[] NOT NULL DEFAULT ARRAY[1,2,3,4,5];

CREATE OR REPLACE FUNCTION public.audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % operations are not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS audit_log_block_update ON public.audit_log;
DROP TRIGGER IF EXISTS audit_log_block_delete ON public.audit_log;
CREATE TRIGGER audit_log_block_update BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_append_only();
CREATE TRIGGER audit_log_block_delete BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_append_only();

REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;
