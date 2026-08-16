-- One-time (single-occurrence) classes: a class held on a specific date,
-- outside the weekly recurring pattern (e.g. an extra class held once
-- this month). Distinct from scheduled_classes (which recurs by weekday
-- forever) and from class_sessions (which is always an override of a
-- recurring class). Anti-overlap enforced the same way as
-- scheduled_classes: EXCLUDE per branch+date+time range, reusing the
-- existing public.class_time_range type.

BEGIN;

CREATE TABLE public.one_time_classes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  discipline_id  uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  teacher_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  class_date     date NOT NULL,
  start_time     time NOT NULL,
  end_time       time GENERATED ALWAYS AS (start_time + interval '1 hour') STORED,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_time_classes_no_overlap EXCLUDE USING gist (
    branch_id WITH =,
    class_date WITH =,
    public.class_time_range(start_time, (start_time + interval '1 hour')::time, '[)') WITH &&
  )
);
CREATE INDEX one_time_classes_branch_id_idx ON public.one_time_classes (branch_id);
CREATE INDEX one_time_classes_discipline_id_idx ON public.one_time_classes (discipline_id);
CREATE INDEX one_time_classes_teacher_id_idx ON public.one_time_classes (teacher_id);
CREATE INDEX one_time_classes_class_date_idx ON public.one_time_classes (class_date);
COMMENT ON TABLE public.one_time_classes IS 'Single-occurrence classes on a specific date, outside the weekly recurring pattern (scheduled_classes)';

CREATE TRIGGER one_time_classes_updated_at
  BEFORE UPDATE ON public.one_time_classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: mirrors scheduled_classes exactly (branch_id is a direct column,
-- no join/helper needed).
ALTER TABLE public.one_time_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_time_classes FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on one_time_classes"
  ON public.one_time_classes FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on one_time_classes"
  ON public.one_time_classes FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id));

CREATE POLICY "Admin global read on one_time_classes"
  ON public.one_time_classes FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

CREATE POLICY "Teacher branch-scoped read on one_time_classes"
  ON public.one_time_classes FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, branch_id));

REVOKE INSERT, UPDATE, DELETE ON public.one_time_classes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.one_time_classes TO authenticated;

COMMIT;
