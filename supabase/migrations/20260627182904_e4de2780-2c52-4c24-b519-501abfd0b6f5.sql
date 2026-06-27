
REVOKE EXECUTE ON FUNCTION public.notify(uuid,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_task_assigned() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_complaint() FROM PUBLIC, anon, authenticated;
