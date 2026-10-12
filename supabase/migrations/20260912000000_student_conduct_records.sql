-- 20260912000000_student_conduct_records.sql
-- Student conduct records: fines ("multas") and warnings ("llamados de
-- atención"). CREATE-only additive; modeled after student_notes (20260819000000).
--
-- Lifecycle:
--   - INSERT: branch admin or teacher registers a fine or warning.
--   - UPDATE: restricted to pay columns (fines) and void columns. Records are
--     never edited; a trigger guard enforces the state machine:
--     no un-void, no paying voided records, no reverting a paid fine.
--   - DELETE: nobody.

BEGIN;

-- 1. Table
CREATE TABLE public.student_conduct_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  kind          text NOT NULL,
  reason        text NOT NULL,
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  amount        numeric(10, 2),
  status        text NOT NULL,
  paid_at       timestamptz,
  paid_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_at     timestamptz,
  voided_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason   text,
  created_by    uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_conduct_records_kind_ck CHECK (kind IN ('fine', 'warning')),
  CONSTRAINT student_conduct_records_reason_len_ck CHECK (char_length(reason) BETWEEN 1 AND 2000),
  CONSTRAINT student_conduct_records_incident_not_future_ck CHECK (incident_date <= CURRENT_DATE),
  CONSTRAINT student_conduct_records_amount_ck CHECK (
    (kind = 'fine' AND amount IS NOT NULL AND amount > 0)
    OR (kind = 'warning' AND amount IS NULL)
  ),
  CONSTRAINT student_conduct_records_status_kind_ck CHECK (
    (kind = 'fine' AND status IN ('pending', 'paid'))
    OR (kind = 'warning' AND status = 'issued')
  ),
  CONSTRAINT student_conduct_records_paid_consistency_ck CHECK (
    (status = 'paid' AND kind = 'fine' AND paid_at IS NOT NULL AND paid_by IS NOT NULL)
    OR (status <> 'paid' AND paid_at IS NULL AND paid_by IS NULL)
  ),
  CONSTRAINT student_conduct_records_void_consistency_ck CHECK (
    (voided_at IS NULL AND voided_by IS NULL AND void_reason IS NULL)
    OR (voided_at IS NOT NULL AND voided_by IS NOT NULL AND void_reason IS NOT NULL
        AND char_length(void_reason) BETWEEN 1 AND 500)
  )
);

-- 2. Indexes
CREATE INDEX student_conduct_records_student_created_idx
  ON public.student_conduct_records (student_id, created_at DESC);
CREATE INDEX student_conduct_records_pending_fines_idx
  ON public.student_conduct_records (student_id)
  WHERE kind = 'fine' AND status = 'pending' AND voided_at IS NULL;

COMMENT ON TABLE public.student_conduct_records IS
  'Immutable conduct records per student: fines (amount, pending|paid) and warnings (issued). Voiding is terminal and audited via voided_at/voided_by/void_reason; records are never edited or deleted.';

-- 3. updated_at trigger (shared function)
CREATE TRIGGER student_conduct_records_updated_at
  BEFORE UPDATE ON public.student_conduct_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Update guard: identity immutable, void is terminal, paid is terminal,
--    voided records can never be paid (defense in depth on top of RLS and
--    column-level grants).
CREATE OR REPLACE FUNCTION private.prevent_conduct_record_invalid_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.incident_date IS DISTINCT FROM OLD.incident_date
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'conduct record identity fields are immutable';
  END IF;

  IF OLD.voided_at IS NOT NULL AND (
       NEW.voided_at IS DISTINCT FROM OLD.voided_at
       OR NEW.voided_by IS DISTINCT FROM OLD.voided_by
       OR NEW.void_reason IS DISTINCT FROM OLD.void_reason ) THEN
    RAISE EXCEPTION 'voided conduct records cannot be modified or un-voided';
  END IF;

  IF OLD.status = 'paid' AND NEW.status <> 'paid' THEN
    RAISE EXCEPTION 'paid fines cannot be reverted to pending';
  END IF;

  IF NEW.status = 'paid' AND NEW.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'voided conduct records cannot be paid';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.prevent_conduct_record_invalid_update() FROM public;

CREATE TRIGGER student_conduct_records_guard_update
  BEFORE UPDATE ON public.student_conduct_records
  FOR EACH ROW EXECUTE FUNCTION private.prevent_conduct_record_invalid_update();

-- 5. RLS (branch-scoped; owner read-only; student self-read; no DELETE)
ALTER TABLE public.student_conduct_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_conduct_records FORCE ROW LEVEL SECURITY;

-- 5a Owner read-only
CREATE POLICY "Owner read-only on student_conduct_records" ON public.student_conduct_records
  FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum));

-- 5b Admin branch-scoped read
CREATE POLICY "Admin branch-scoped read on student_conduct_records" ON public.student_conduct_records
  FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)));

-- 5c Teacher branch-scoped read
CREATE POLICY "Teacher branch-scoped read on student_conduct_records" ON public.student_conduct_records
  FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)));

-- 5d Student self-read (students.auth_user_id is unique; the EXISTS subquery
-- is itself filtered by the students RLS "Student reads own profile" policy)
CREATE POLICY "Student reads own conduct records" ON public.student_conduct_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.students
    WHERE students.id = student_conduct_records.student_id
      AND students.auth_user_id = auth.uid()
  ));

-- 5e Admin branch-scoped INSERT, attributed to themselves
CREATE POLICY "Admin branch-scoped insert on student_conduct_records" ON public.student_conduct_records
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id))
    AND created_by = auth.uid()
  );

-- 5f Teacher branch-scoped INSERT, attributed to themselves
CREATE POLICY "Teacher branch-scoped insert on student_conduct_records" ON public.student_conduct_records
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id))
    AND created_by = auth.uid()
  );

-- 5g Admin branch-scoped UPDATE (privilege layer further limits the columns)
CREATE POLICY "Admin branch-scoped update on student_conduct_records" ON public.student_conduct_records
  FOR UPDATE TO authenticated
  USING (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)))
  WITH CHECK (private.has_branch_role(auth.uid(), 'admin'::public.role_enum, private.student_branch_id(student_id)));

-- 5h Teacher branch-scoped UPDATE (privilege layer further limits the columns)
CREATE POLICY "Teacher branch-scoped update on student_conduct_records" ON public.student_conduct_records
  FOR UPDATE TO authenticated
  USING (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)))
  WITH CHECK (private.has_branch_role(auth.uid(), 'teacher'::public.role_enum, private.student_branch_id(student_id)));

-- 6. Grants (defense in depth; RLS is the authority)
-- REVOKE ALL first: Supabase default privileges grant authenticated broad
-- table-level UPDATE at creation time (see 20260819000001), and column-level
-- GRANTs are additive only.
REVOKE ALL ON public.student_conduct_records FROM anon;
REVOKE ALL ON public.student_conduct_records FROM authenticated;
GRANT SELECT, INSERT ON public.student_conduct_records TO authenticated;
GRANT UPDATE (status, paid_at, paid_by, voided_at, voided_by, void_reason, updated_at)
  ON public.student_conduct_records TO authenticated;
-- No DELETE grant for any role: records are voided, never removed.

COMMIT;
