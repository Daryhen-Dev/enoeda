-- 20260819000000_progress_and_notes.sql
-- Level catalog, promotion history, categorized logbook. CREATE-only additive.
BEGIN;

-- 1. discipline_levels (Owner-managed closed catalog)
CREATE TABLE public.discipline_levels (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id               uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE CASCADE,
  name                        text NOT NULL,
  color                       text,
  sort_order                  integer NOT NULL,
  required_attended_sessions  integer NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discipline_levels_discipline_sort_uq UNIQUE (discipline_id, sort_order),
  CONSTRAINT discipline_levels_name_len_ck CHECK (char_length(name) BETWEEN 1 AND 100),
  CONSTRAINT discipline_levels_sort_nonneg_ck CHECK (sort_order >= 0),
  CONSTRAINT discipline_levels_required_nonneg_ck CHECK (required_attended_sessions >= 0)
);
CREATE INDEX discipline_levels_discipline_id_idx ON public.discipline_levels (discipline_id);
COMMENT ON TABLE public.discipline_levels IS 'Owner-managed closed level/belt catalog per discipline; min sort_order = initial level';

-- 2. student_progress (promotion history — append-only)
CREATE TABLE public.student_progress (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  discipline_id uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  level_id      uuid NOT NULL REFERENCES public.discipline_levels(id) ON DELETE RESTRICT,
  promoted_at   date NOT NULL DEFAULT CURRENT_DATE,
  observations  text,
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_progress_observations_len_ck CHECK (observations IS NULL OR char_length(observations) <= 500),
  CONSTRAINT student_progress_promoted_not_future_ck CHECK (promoted_at <= CURRENT_DATE)
);
CREATE INDEX student_progress_student_discipline_idx ON public.student_progress (student_id, discipline_id, promoted_at DESC);
CREATE INDEX student_progress_level_id_idx ON public.student_progress (level_id);
COMMENT ON TABLE public.student_progress IS 'Per student×discipline promotion events; current level = MAX(promoted_at)';

-- 3. student_notes (logbook)
CREATE TABLE public.student_notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  discipline_id uuid REFERENCES public.disciplines(id) ON DELETE SET NULL,
  category      text NOT NULL,
  content       text NOT NULL,
  is_completed  boolean NOT NULL DEFAULT false,
  completed_at  timestamptz,
  completed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_notes_category_ck CHECK (category IN ('tecnica','fisico','actitud','medica','general')),
  CONSTRAINT student_notes_content_len_ck CHECK (char_length(content) BETWEEN 1 AND 2000),
  CONSTRAINT student_notes_completed_consistency_ck CHECK (
    (is_completed = true  AND completed_at IS NOT NULL AND completed_by IS NOT NULL) OR
    (is_completed = false AND completed_at IS NULL     AND completed_by IS NULL)
  )
);
CREATE INDEX student_notes_student_discipline_idx ON public.student_notes (student_id, discipline_id);
CREATE INDEX student_notes_student_completed_idx ON public.student_notes (student_id, is_completed);
COMMENT ON TABLE public.student_notes IS 'Categorized logbook; content immutable, only completion state mutable';

-- 4. updated_at triggers (student_progress is append-only → no trigger)
CREATE TRIGGER discipline_levels_updated_at BEFORE UPDATE ON public.discipline_levels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER student_notes_updated_at BEFORE UPDATE ON public.student_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. RLS: discipline_levels (Owner write, authenticated read)
ALTER TABLE public.discipline_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_levels FORCE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read discipline_levels" ON public.discipline_levels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owner write discipline_levels" ON public.discipline_levels
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

-- 6. RLS: student_progress (branch-scoped read; asymmetric INSERT; no UPDATE/DELETE)
ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_progress FORCE ROW LEVEL SECURITY;
-- 6a Owner read-only
CREATE POLICY "Owner read-only on student_progress" ON public.student_progress
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'owner'::public.role_enum));
-- 6b Admin branch-scoped read
CREATE POLICY "Admin branch-scoped read on student_progress" ON public.student_progress
  FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)));
-- 6c Teacher branch-scoped read
CREATE POLICY "Teacher branch-scoped read on student_progress" ON public.student_progress
  FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)));
-- 6d Admin branch-scoped INSERT (manual promotions)
CREATE POLICY "Admin branch-scoped insert on student_progress" ON public.student_progress
  FOR INSERT TO authenticated
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)));
-- 6e Owner INSERT safety net
CREATE POLICY "Owner insert on student_progress" ON public.student_progress
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));
-- 6f Initial-level self-service INSERT (Admin OR Teacher) — enrollment side-effect only
CREATE POLICY "Branch-role initial level insert on student_progress" ON public.student_progress
  FOR INSERT TO authenticated
  WITH CHECK (
    ( private.has_branch_role(auth.uid(), 'admin'::public.role_enum,   private.student_branch_id(student_id))
      OR private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)) )
    AND NOT EXISTS (
      SELECT 1 FROM public.student_progress sp
      WHERE sp.student_id = student_progress.student_id
        AND sp.discipline_id = student_progress.discipline_id )
    AND level_id = (
      SELECT dl.id FROM public.discipline_levels dl
      WHERE dl.discipline_id = student_progress.discipline_id
      ORDER BY dl.sort_order ASC LIMIT 1 )
  );

-- 7. RLS: student_notes (branch-scoped read; Admin+Teacher INSERT & UPDATE; no DELETE)
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY "Owner read-only on student_notes" ON public.student_notes
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'owner'::public.role_enum));
CREATE POLICY "Admin branch-scoped read on student_notes" ON public.student_notes
  FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)));
CREATE POLICY "Teacher branch-scoped read on student_notes" ON public.student_notes
  FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)));
CREATE POLICY "Admin branch-scoped insert on student_notes" ON public.student_notes
  FOR INSERT TO authenticated
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)));
CREATE POLICY "Teacher branch-scoped insert on student_notes" ON public.student_notes
  FOR INSERT TO authenticated
  WITH CHECK (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)));
CREATE POLICY "Admin branch-scoped update on student_notes" ON public.student_notes
  FOR UPDATE TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)));
CREATE POLICY "Teacher branch-scoped update on student_notes" ON public.student_notes
  FOR UPDATE TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)))
  WITH CHECK (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)));

-- 8. Grants (defense in depth; RLS is the authority)
REVOKE INSERT, UPDATE, DELETE ON public.discipline_levels FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.student_progress FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.student_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discipline_levels TO authenticated;
GRANT SELECT, INSERT ON public.student_progress TO authenticated; -- append-only
GRANT SELECT, INSERT ON public.student_notes TO authenticated;
GRANT UPDATE (is_completed, completed_at, completed_by) ON public.student_notes TO authenticated; -- content immutable at privilege level

COMMIT;
