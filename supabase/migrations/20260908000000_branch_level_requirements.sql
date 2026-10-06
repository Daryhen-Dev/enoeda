-- Branch-scoped belt promotion requirements
--
-- Capabilities realized:
--   - public.branch_level_requirements: a per-branch override of a level's
--     required attended sessions. A branch admin may customize the promotion
--     requirement for their own branch; without an override row the level's
--     general (owner-managed) value applies.
--   - One row per (branch_id, level_id); clearing an override deletes the row
--     so the general value applies again. This is configuration data, not
--     history.
--   - Level name, color, order, creation and the initial level remain
--     owner-only concerns managed through discipline_levels.

BEGIN;

-- =============================================================================
-- 1. branch_level_requirements table + indexes
-- =============================================================================

CREATE TABLE public.branch_level_requirements (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                  uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  level_id                   uuid NOT NULL REFERENCES public.discipline_levels(id) ON DELETE CASCADE,
  required_attended_sessions integer NOT NULL,
  updated_by                 uuid,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branch_level_requirements_required_nonneg_ck
    CHECK (required_attended_sessions >= 0),
  CONSTRAINT branch_level_requirements_branch_level_uq UNIQUE (branch_id, level_id)
);

CREATE INDEX branch_level_requirements_level_id_idx
  ON public.branch_level_requirements (level_id);

COMMENT ON TABLE public.branch_level_requirements IS
  'Per-branch override of discipline_levels.required_attended_sessions; no row means the general value applies';

-- =============================================================================
-- 2. updated_at trigger (reuses the shared set_updated_at function)
-- =============================================================================

CREATE TRIGGER branch_level_requirements_updated_at
  BEFORE UPDATE ON public.branch_level_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. RLS: owner full access, branch admin write, branch teacher read
-- =============================================================================

ALTER TABLE public.branch_level_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_level_requirements FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on branch_level_requirements"
  ON public.branch_level_requirements FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on branch_level_requirements"
  ON public.branch_level_requirements FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id));

CREATE POLICY "Teacher branch-scoped read on branch_level_requirements"
  ON public.branch_level_requirements FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, branch_id));

-- =============================================================================
-- 4. Grants (defense in depth; RLS is the authority)
-- =============================================================================

REVOKE INSERT, UPDATE, DELETE ON public.branch_level_requirements FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_level_requirements TO authenticated;

COMMIT;
