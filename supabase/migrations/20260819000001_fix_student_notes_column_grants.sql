-- 20260819000001_fix_student_notes_column_grants.sql
-- Fixes a grant gap introduced in 20260819000000_progress_and_notes.sql:
-- Supabase's schema-level default privileges grant `authenticated` full
-- table-level UPDATE at table creation time, BEFORE any migration-level
-- GRANT statement runs. The prior migration's
--   GRANT UPDATE (is_completed, completed_at, completed_by) ON public.student_notes TO authenticated;
-- is additive and never restricted the pre-existing broader UPDATE grant,
-- so `content`/`category`/etc. remained updatable at the privilege layer
-- despite the design intent of "content immutable, only completion state
-- mutable" (defense-in-depth alongside RLS + app-layer Zod validation).
--
-- This migration explicitly REVOKEs the broad UPDATE grant first, then
-- re-GRANTs UPDATE scoped to only the mutable columns.
BEGIN;

REVOKE UPDATE ON public.student_notes FROM authenticated;
GRANT UPDATE (is_completed, completed_at, completed_by) ON public.student_notes TO authenticated;

COMMIT;
