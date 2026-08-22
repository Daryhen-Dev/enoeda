-- Global admin payment visibility is intentionally SELECT-only.
BEGIN;

CREATE OR REPLACE FUNCTION private.has_any_active_admin_role(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.branches b ON b.id = ur.branch_id
    WHERE ur.user_id = p_user_id
      AND ur.role = 'admin'::public.role_enum
      AND ur.revoked_at IS NULL
      AND b.is_active
  );
$$;
REVOKE EXECUTE ON FUNCTION private.has_any_active_admin_role(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.has_any_active_admin_role(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.active_student_discipline_branch(
  p_student_discipline_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = private.student_discipline_branch_id(p_student_discipline_id)
      AND b.is_active
  );
$$;
REVOKE EXECUTE ON FUNCTION private.active_student_discipline_branch(uuid) FROM public;
GRANT EXECUTE ON FUNCTION private.active_student_discipline_branch(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admin global read-only on payments" ON public.payments;
CREATE POLICY "Admin global read-only on payments"
  ON public.payments FOR SELECT TO authenticated
  USING (
    private.has_any_active_admin_role(auth.uid())
    AND private.active_student_discipline_branch(student_discipline_id)
  );

DROP POLICY IF EXISTS "Admin global read-only on class_payments" ON public.class_payments;
CREATE POLICY "Admin global read-only on class_payments"
  ON public.class_payments FOR SELECT TO authenticated
  USING (
    private.has_any_active_admin_role(auth.uid())
    AND private.active_student_discipline_branch(student_discipline_id)
  );

COMMIT;
