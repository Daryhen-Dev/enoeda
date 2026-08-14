-- 20260816000000_disciplines_enrollments.sql
-- Disciplines catalog, student↔discipline enrollment state, append-only audit.
-- Branch-scoped RLS via student. Authority: Supabase SQL migration (sole DDL owner).

BEGIN;

-- 1. disciplines (catalog)
CREATE TABLE public.disciplines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  code        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX disciplines_name_uq ON public.disciplines (lower(name));
CREATE UNIQUE INDEX disciplines_code_uq ON public.disciplines (lower(code));
COMMENT ON TABLE public.disciplines IS 'Discipline catalog (Karate, Kickboxing, extensible)';

-- 2. student_disciplines (current state — one row per pair)
CREATE TABLE public.student_disciplines (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  discipline_id  uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  enrolled_at    date NOT NULL DEFAULT CURRENT_DATE,
  is_active      boolean NOT NULL DEFAULT true,
  suspended_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_disciplines_pair_uq UNIQUE (student_id, discipline_id),
  CONSTRAINT student_disciplines_enrolled_not_future_ck CHECK (enrolled_at <= CURRENT_DATE)
);
CREATE INDEX student_disciplines_student_id_idx ON public.student_disciplines (student_id);
CREATE INDEX student_disciplines_discipline_id_idx ON public.student_disciplines (discipline_id);
COMMENT ON TABLE public.student_disciplines IS 'Per student×discipline enrollment state; anchor for future per-discipline payments';

-- 3. discipline_events (append-only audit log)
CREATE TABLE public.discipline_events (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_discipline_id uuid NOT NULL REFERENCES public.student_disciplines(id) ON DELETE CASCADE,
  event_type            text NOT NULL,
  performed_by          uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_date            timestamptz NOT NULL DEFAULT now(),
  notes                 text,
  CONSTRAINT discipline_events_type_ck CHECK (event_type IN ('enrolled','suspended','reactivated'))
);
CREATE INDEX discipline_events_student_discipline_id_idx ON public.discipline_events (student_discipline_id);
COMMENT ON TABLE public.discipline_events IS 'Append-only enrollment lifecycle audit trail';

-- 4. updated_at triggers (reuse existing public.set_updated_at)
CREATE TRIGGER disciplines_updated_at
  BEFORE UPDATE ON public.disciplines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER student_disciplines_updated_at
  BEFORE UPDATE ON public.student_disciplines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. private.student_branch_id(uuid) — resolve a student's branch for RLS
CREATE OR REPLACE FUNCTION private.student_branch_id(p_student_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT branch_id FROM public.students WHERE id = p_student_id;
$$;
REVOKE EXECUTE ON FUNCTION private.student_branch_id(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.student_branch_id(uuid) TO authenticated;

-- 6. RLS: disciplines (catalog — global read, owner write)
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplines FORCE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read disciplines"
  ON public.disciplines FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owner write disciplines"
  ON public.disciplines FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

-- 7. RLS: student_disciplines (branch-scoped via student)
ALTER TABLE public.student_disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_disciplines FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on student_disciplines"
  ON public.student_disciplines FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on student_disciplines"
  ON public.student_disciplines FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)));

CREATE POLICY "Admin global read on student_disciplines"
  ON public.student_disciplines FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

CREATE POLICY "Teacher branch-scoped read on student_disciplines"
  ON public.student_disciplines FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)));

-- 8. RLS: discipline_events (branch-scoped via student_discipline -> student)
ALTER TABLE public.discipline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discipline_events FORCE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access on discipline_events"
  ON public.discipline_events FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum))
  WITH CHECK (private.has_role(auth.uid(), 'owner'::public.role_enum));

CREATE POLICY "Admin branch-scoped write on discipline_events"
  ON public.discipline_events FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    private.student_branch_id((SELECT sd.student_id FROM public.student_disciplines sd WHERE sd.id = student_discipline_id))))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum,
    private.student_branch_id((SELECT sd.student_id FROM public.student_disciplines sd WHERE sd.id = student_discipline_id))));

CREATE POLICY "Admin global read on discipline_events"
  ON public.discipline_events FOR SELECT TO authenticated
  USING (private.has_any_admin_role(auth.uid()));

CREATE POLICY "Teacher branch-scoped read on discipline_events"
  ON public.discipline_events FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum,
    private.student_branch_id((SELECT sd.student_id FROM public.student_disciplines sd WHERE sd.id = student_discipline_id))));

-- 9. Grants (defense in depth; RLS is the authority)
REVOKE INSERT, UPDATE, DELETE ON public.disciplines FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.student_disciplines FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.discipline_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_disciplines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discipline_events TO authenticated;

-- 10. Seed catalog (idempotent)
INSERT INTO public.disciplines (name, code) VALUES
  ('Karate', 'karate'),
  ('Kickboxing', 'kickboxing')
ON CONFLICT DO NOTHING;

COMMIT;
