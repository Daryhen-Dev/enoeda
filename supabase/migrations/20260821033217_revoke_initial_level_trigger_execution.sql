-- 20260821033217_revoke_initial_level_trigger_execution.sql
-- Trigger helpers are internal database functions and must not be callable as RPCs.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.enforce_discipline_initial_level_match()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_first_discipline_level_as_initial()
  FROM PUBLIC, anon, authenticated;

COMMIT;
