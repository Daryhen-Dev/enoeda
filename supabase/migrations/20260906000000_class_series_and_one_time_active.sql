-- Class series identity + one-time class activity flag
--
-- Capabilities realized:
--   - scheduled_classes.series_id: a REAL series identity for recurring
--     batches, so "remove the series" no longer relies on the
--     (branch_id, discipline_id, start_time) heuristic.
--   - one_time_classes.is_active: soft-deactivation flag for one-time
--     classes, enabling "remove ALL future classes" for a branch while
--     preserving history (soft-deactivate only; never deletes).
--
-- Backfill contract: every existing scheduled_classes row MUST end with a
-- non-null series_id. Legacy rows are grouped by
-- (branch_id, discipline_id, start_time) — exactly the round-2 removal
-- heuristic — and each group receives its min(id) as the shared series_id.

BEGIN;

-- =============================================================================
-- 1. Add series_id column + index to scheduled_classes
-- =============================================================================

ALTER TABLE public.scheduled_classes
  ADD COLUMN series_id uuid;

CREATE INDEX scheduled_classes_series_id_idx
  ON public.scheduled_classes (series_id);

-- =============================================================================
-- 2. Backfill series_id from the legacy (branch_id, discipline_id, start_time)
--    grouping; the group's lowest id (uuid ordering) becomes the shared series
--    identity. min() is not defined for uuid, so array_agg with ORDER BY is
--    used instead.
-- =============================================================================

WITH legacy_series AS (
  SELECT
    (array_agg(id ORDER BY id))[1] AS series_id,
    branch_id,
    discipline_id,
    start_time
  FROM public.scheduled_classes
  GROUP BY branch_id, discipline_id, start_time
)
UPDATE public.scheduled_classes AS sc
SET series_id = ls.series_id
FROM legacy_series AS ls
WHERE sc.branch_id = ls.branch_id
  AND sc.discipline_id = ls.discipline_id
  AND sc.start_time = ls.start_time;

-- =============================================================================
-- 3. Add is_active flag to one_time_classes (soft-deactivate only)
-- =============================================================================

ALTER TABLE public.one_time_classes
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

COMMIT;
