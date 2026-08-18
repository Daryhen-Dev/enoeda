BEGIN;
REVOKE EXECUTE ON FUNCTION public.enforce_active_student_branch() FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
