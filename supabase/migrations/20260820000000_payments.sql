-- Payments Module Migration
-- Change #5: Monthly/block and per-class payments, delinquency tracking
-- Additive: 2 new tables + ALTER disciplines + ALTER student_disciplines + RLS + grants

-- ============================================================
-- 1. disciplines: add class_price + REVOKE-then-GRANT pattern
-- ============================================================
ALTER TABLE public.disciplines ADD COLUMN class_price numeric(10,2);
ALTER TABLE public.disciplines
  ADD CONSTRAINT disciplines_class_price_ck CHECK (class_price IS NULL OR class_price >= 0);

-- Kill table-wide UPDATE that Supabase auto-granted + migration #1 granted
REVOKE UPDATE ON public.disciplines FROM authenticated;
-- Re-grant ONLY class_price column
GRANT  UPDATE (class_price) ON public.disciplines TO authenticated;

-- Admin-only UPDATE policy for pricing
CREATE POLICY "Admin update disciplines pricing"
  ON public.disciplines FOR UPDATE TO authenticated
  USING (private.has_any_admin_role(auth.uid()))
  WITH CHECK (private.has_any_admin_role(auth.uid()));

-- ============================================================
-- 2. student_disciplines: delinquency anchor
-- ============================================================
ALTER TABLE public.student_disciplines ADD COLUMN next_due_date date;
CREATE INDEX student_disciplines_next_due_date_idx
  ON public.student_disciplines (next_due_date) WHERE next_due_date IS NOT NULL;

-- ============================================================
-- 3. Branch resolver helper for payment tables
-- ============================================================
CREATE OR REPLACE FUNCTION private.student_discipline_branch_id(p_sd_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.branch_id FROM public.student_disciplines sd
  JOIN public.students s ON s.id = sd.student_id WHERE sd.id = p_sd_id;
$$;
REVOKE EXECUTE ON FUNCTION private.student_discipline_branch_id(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION private.student_discipline_branch_id(uuid) TO authenticated;

-- ============================================================
-- 4. payments table (monthly/block)
-- ============================================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_discipline_id uuid NOT NULL REFERENCES public.student_disciplines(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  months_covered smallint NOT NULL CHECK (months_covered BETWEEN 1 AND 12),
  period_start date NOT NULL,
  period_end date NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_period_ck CHECK (period_end > period_start),
  CONSTRAINT payments_note_len_ck CHECK (note IS NULL OR char_length(note) <= 500)
);
CREATE INDEX payments_student_discipline_id_idx ON public.payments (student_discipline_id);

-- ============================================================
-- 5. class_payments table (per-class)
-- ============================================================
CREATE TABLE public.class_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_discipline_id uuid NOT NULL REFERENCES public.student_disciplines(id) ON DELETE RESTRICT,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  class_date date NOT NULL DEFAULT CURRENT_DATE,
  scheduled_class_id uuid REFERENCES public.scheduled_classes(id) ON DELETE SET NULL,
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX class_payments_student_discipline_id_idx ON public.class_payments (student_discipline_id);
CREATE INDEX class_payments_class_date_idx ON public.class_payments (class_date);

-- ============================================================
-- 6. RLS: Enable + Force on both tables
-- ============================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.class_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_payments FORCE ROW LEVEL SECURITY;

-- payments: Admin(all, branch-scoped) + Owner(read-only). Teacher has NO policy = denied.
CREATE POLICY "Owner read-only on payments" ON public.payments FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'owner'::public.role_enum));
CREATE POLICY "Admin branch-scoped write on payments" ON public.payments FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(),'admin'::public.role_enum, private.student_discipline_branch_id(student_discipline_id)))
  WITH CHECK (private.has_branch_role(auth.uid(),'admin'::public.role_enum, private.student_discipline_branch_id(student_discipline_id)));

-- class_payments: Admin(all) + Teacher(select+insert) + Owner(read-only), all branch-scoped.
CREATE POLICY "Owner read-only on class_payments" ON public.class_payments FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(),'owner'::public.role_enum));
CREATE POLICY "Admin branch-scoped write on class_payments" ON public.class_payments FOR ALL TO authenticated
  USING (private.has_branch_role(auth.uid(),'admin'::public.role_enum, private.student_discipline_branch_id(student_discipline_id)))
  WITH CHECK (private.has_branch_role(auth.uid(),'admin'::public.role_enum, private.student_discipline_branch_id(student_discipline_id)));
CREATE POLICY "Teacher branch-scoped read on class_payments" ON public.class_payments FOR SELECT TO authenticated
  USING (private.has_branch_role(auth.uid(),'teacher'::public.role_enum, private.student_discipline_branch_id(student_discipline_id)));
CREATE POLICY "Teacher branch-scoped insert on class_payments" ON public.class_payments FOR INSERT TO authenticated
  WITH CHECK (private.has_branch_role(auth.uid(),'teacher'::public.role_enum, private.student_discipline_branch_id(student_discipline_id)));

-- ============================================================
-- 7. Grants: REVOKE anon + GRANT authenticated
-- ============================================================
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.class_payments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_payments TO authenticated;
