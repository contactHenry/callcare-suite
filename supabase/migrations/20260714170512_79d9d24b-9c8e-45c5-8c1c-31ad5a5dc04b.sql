
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.expire_cancelled_subscriptions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH expired AS (
    UPDATE public.org_subscriptions
       SET status = 'cancelled',
           updated_at = now()
     WHERE cancel_at_period_end = true
       AND status <> 'cancelled'
       AND current_period_end IS NOT NULL
       AND current_period_end < now()
    RETURNING org_id, plan_id
  )
  INSERT INTO public.subscription_events (org_id, event_type, from_plan_id, to_plan_id, metadata)
  SELECT org_id, 'plan_expired', plan_id, NULL, jsonb_build_object('source','cron')
    FROM expired;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;

REVOKE EXECUTE ON FUNCTION public.expire_cancelled_subscriptions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_cancelled_subscriptions() FROM anon, authenticated;

SELECT cron.schedule(
  'expire-cancelled-subscriptions',
  '15 2 * * *',
  $$SELECT public.expire_cancelled_subscriptions();$$
);
