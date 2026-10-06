-- Class series names — dedicated class_series catalog
--
-- Capabilities realized:
--   - public.class_series: a named catalog for recurring-class series
--     ("concurrencias"). Admins name a series at batch-creation time and
--     can rename it later; legacy series receive an auto-generated name.
--   - scheduled_classes.series_id gains a real FOREIGN KEY to
--     class_series, making the series identity referentially sound.
--
-- Backfill contract: after 20260906000000_class_series_and_one_time_active,
-- every scheduled_classes row has a non-null series_id, so the backfill
-- below creates EXACTLY ONE class_series row per distinct series_id.
-- Names are auto-generated as "<discipline> — <HH:MM>" (min discipline
-- name / min start time within the series); names are NOT unique.

BEGIN;

-- =============================================================================
-- 1. class_series table + branch index
-- =============================================================================

CREATE TABLE public.class_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX class_series_branch_id_idx
  ON public.class_series (branch_id);

-- =============================================================================
-- 2. Backfill: one row per distinct existing series_id. Every
--    scheduled_classes.series_id is non-null after the previous migration,
--    so each series ends up with exactly one named row.
-- =============================================================================

INSERT INTO public.class_series (id, branch_id, name)
SELECT
  sc.series_id,
  sc.branch_id,
  min(d.name) || ' — ' || to_char(min(sc.start_time), 'HH24:MI')
FROM public.scheduled_classes sc
JOIN public.disciplines d ON d.id = sc.discipline_id
GROUP BY sc.series_id, sc.branch_id;

-- =============================================================================
-- 3. Referential integrity: series_id now points at the catalog
-- =============================================================================

ALTER TABLE public.scheduled_classes
  ADD CONSTRAINT scheduled_classes_series_id_fkey
  FOREIGN KEY (series_id) REFERENCES public.class_series(id);

-- =============================================================================
-- 4. RLS: class_series (policies mirror the scheduled_classes policies)
-- =============================================================================

ALTER TABLE public.class_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_series FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on class_series"
  ON public.class_series FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on class_series"
  ON public.class_series FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id));

CREATE POLICY "Admin global read on class_series"
  ON public.class_series FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

CREATE POLICY "Teacher branch-scoped read on class_series"
  ON public.class_series FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, branch_id));

-- =============================================================================
-- 5. Grants (defense in depth; RLS is the authority)
-- =============================================================================

REVOKE INSERT, UPDATE, DELETE ON public.class_series FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_series TO authenticated;

COMMIT;
