-- Payment corrections, branch payment settings, and immutable audit evidence.
-- Additive and intentionally unapplied.
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.branches
  ADD COLUMN payment_due_day smallint NOT NULL DEFAULT 5,
  ADD COLUMN payment_edit_window_days smallint NOT NULL DEFAULT 3,
  ADD CONSTRAINT branches_payment_due_day_ck CHECK (payment_due_day BETWEEN 1 AND 31),
  ADD CONSTRAINT branches_payment_edit_window_days_ck CHECK (payment_edit_window_days BETWEEN 0 AND 365);

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_months_covered_check,
  ADD CONSTRAINT payments_months_covered_ck CHECK (months_covered BETWEEN 1 AND 24),
  ADD CONSTRAINT payments_months_covered_matches_period_ck CHECK (
    months_covered = ((EXTRACT(YEAR FROM period_end)::integer - EXTRACT(YEAR FROM period_start)::integer) * 12)
      + EXTRACT(MONTH FROM period_end)::integer - EXTRACT(MONTH FROM period_start)::integer
  );

ALTER TABLE public.payments
  ADD CONSTRAINT payments_coverage_no_overlap
  EXCLUDE USING gist (
    student_discipline_id WITH =,
    daterange(period_start, period_end, '[)') WITH &&
  );

CREATE INDEX payments_student_discipline_period_idx
  ON public.payments (student_discipline_id, period_start, period_end);

CREATE TABLE public.payment_audit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  payment_kind text NOT NULL CHECK (payment_kind IN ('monthly', 'class')),
  payment_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('update', 'delete')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  before_state jsonb NOT NULL,
  after_state jsonb
);

CREATE INDEX payment_audit_entries_branch_occurred_idx
  ON public.payment_audit_entries (branch_id, occurred_at DESC);

ALTER TABLE public.payment_audit_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_entries FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.active_branch_admin(p_user_id uuid, p_branch_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT private.has_branch_role(p_user_id, 'admin'::public.role_enum, p_branch_id)
    AND EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id AND is_active);
$$;
REVOKE EXECUTE ON FUNCTION private.active_branch_admin(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.active_branch_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.payment_correction_allowed(
  p_branch_id uuid,
  p_created_at timestamptz
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT private.active_branch_admin(auth.uid(), p_branch_id)
    AND clock_timestamp() <= p_created_at + make_interval(days => b.payment_edit_window_days)
  FROM public.branches b
  WHERE b.id = p_branch_id;
$$;
REVOKE EXECUTE ON FUNCTION private.payment_correction_allowed(uuid, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION private.payment_correction_allowed(uuid, timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION private.prevent_payment_identity_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.recorded_by IS DISTINCT FROM OLD.recorded_by
     OR NEW.student_discipline_id IS DISTINCT FROM OLD.student_discipline_id THEN
    RAISE EXCEPTION 'payment identity fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.record_payment_audit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_student_discipline_id uuid;
  v_payment_id uuid;
  v_branch_id uuid;
BEGIN
  v_student_discipline_id := COALESCE(NEW.student_discipline_id, OLD.student_discipline_id);
  v_payment_id := COALESCE(NEW.id, OLD.id);
  v_branch_id := private.student_discipline_branch_id(v_student_discipline_id);

  INSERT INTO public.payment_audit_entries (
    branch_id, payment_kind, payment_id, operation, actor_id, before_state, after_state
  ) VALUES (
    v_branch_id,
    TG_ARGV[0],
    v_payment_id,
    lower(TG_OP),
    auth.uid(),
    to_jsonb(OLD),
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION private.reconcile_payment_next_due_date(p_student_discipline_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_first_uncovered date;
  v_payment record;
  v_due_day smallint;
  v_last_day date;
BEGIN
  SELECT b.payment_due_day
    INTO v_due_day
  FROM public.student_disciplines sd
  JOIN public.students s ON s.id = sd.student_id
  JOIN public.branches b ON b.id = s.branch_id
  WHERE sd.id = p_student_discipline_id;

  SELECT min(period_start)
    INTO v_first_uncovered
  FROM public.payments
  WHERE student_discipline_id = p_student_discipline_id;

  IF v_first_uncovered IS NULL THEN
    UPDATE public.student_disciplines
    SET next_due_date = NULL
    WHERE id = p_student_discipline_id;
    RETURN;
  END IF;

  FOR v_payment IN
    SELECT period_start, period_end
    FROM public.payments
    WHERE student_discipline_id = p_student_discipline_id
    ORDER BY period_start, period_end
  LOOP
    EXIT WHEN v_payment.period_start > v_first_uncovered;
    v_first_uncovered := GREATEST(v_first_uncovered, v_payment.period_end);
  END LOOP;

  v_last_day := (date_trunc('month', v_first_uncovered) + interval '1 month - 1 day')::date;
  UPDATE public.student_disciplines
  SET next_due_date = make_date(
    EXTRACT(YEAR FROM v_first_uncovered)::integer,
    EXTRACT(MONTH FROM v_first_uncovered)::integer,
    LEAST(v_due_day::integer, EXTRACT(DAY FROM v_last_day)::integer)
  )
  WHERE id = p_student_discipline_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.reconcile_payment_after_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM private.reconcile_payment_next_due_date(COALESCE(NEW.student_discipline_id, OLD.student_discipline_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER payments_prevent_identity_change
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.prevent_payment_identity_change();
CREATE TRIGGER class_payments_prevent_identity_change
  BEFORE UPDATE ON public.class_payments
  FOR EACH ROW EXECUTE FUNCTION private.prevent_payment_identity_change();
CREATE TRIGGER payments_audit_updates
  AFTER UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.record_payment_audit('monthly');
CREATE TRIGGER payments_audit_before_delete
  BEFORE DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.record_payment_audit('monthly');
CREATE TRIGGER class_payments_audit_updates
  AFTER UPDATE ON public.class_payments
  FOR EACH ROW EXECUTE FUNCTION private.record_payment_audit('class');
CREATE TRIGGER class_payments_audit_before_delete
  BEFORE DELETE ON public.class_payments
  FOR EACH ROW EXECUTE FUNCTION private.record_payment_audit('class');
CREATE TRIGGER payments_reconcile_next_due
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.reconcile_payment_after_change();

DROP POLICY IF EXISTS "Admin branch-scoped write on payments" ON public.payments;
DROP POLICY IF EXISTS "Admin branch-scoped write on class_payments" ON public.class_payments;

CREATE POLICY "Admin branch-scoped read on payments" ON public.payments FOR SELECT TO authenticated
  USING (private.active_branch_admin(auth.uid(), private.student_discipline_branch_id(student_discipline_id)));
CREATE POLICY "Admin branch-scoped insert on payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (private.active_branch_admin(auth.uid(), private.student_discipline_branch_id(student_discipline_id)));
CREATE POLICY "Admin correction update on payments" ON public.payments FOR UPDATE TO authenticated
  USING (private.payment_correction_allowed(private.student_discipline_branch_id(student_discipline_id), created_at))
  WITH CHECK (private.payment_correction_allowed(private.student_discipline_branch_id(student_discipline_id), created_at));
CREATE POLICY "Admin correction delete on payments" ON public.payments FOR DELETE TO authenticated
  USING (private.payment_correction_allowed(private.student_discipline_branch_id(student_discipline_id), created_at));

CREATE POLICY "Admin branch-scoped read on class_payments" ON public.class_payments FOR SELECT TO authenticated
  USING (private.active_branch_admin(auth.uid(), private.student_discipline_branch_id(student_discipline_id)));
CREATE POLICY "Admin branch-scoped insert on class_payments" ON public.class_payments FOR INSERT TO authenticated
  WITH CHECK (private.active_branch_admin(auth.uid(), private.student_discipline_branch_id(student_discipline_id)));
CREATE POLICY "Admin correction update on class_payments" ON public.class_payments FOR UPDATE TO authenticated
  USING (private.payment_correction_allowed(private.student_discipline_branch_id(student_discipline_id), created_at))
  WITH CHECK (private.payment_correction_allowed(private.student_discipline_branch_id(student_discipline_id), created_at));
CREATE POLICY "Admin correction delete on class_payments" ON public.class_payments FOR DELETE TO authenticated
  USING (private.payment_correction_allowed(private.student_discipline_branch_id(student_discipline_id), created_at));

CREATE POLICY "Owner read-only payment audit" ON public.payment_audit_entries FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'owner'::public.role_enum));
CREATE POLICY "Admin branch-scoped payment audit insert" ON public.payment_audit_entries FOR INSERT TO authenticated
  WITH CHECK (private.active_branch_admin(auth.uid(), branch_id));
CREATE POLICY "Admin branch-scoped payment audit read" ON public.payment_audit_entries FOR SELECT TO authenticated
  USING (private.active_branch_admin(auth.uid(), branch_id));

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.class_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_payments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.payment_audit_entries FROM anon, authenticated;
GRANT SELECT ON public.payment_audit_entries TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments, public.class_payments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments, public.class_payments TO authenticated;

COMMIT;
