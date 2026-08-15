-- Fix: Admin cannot read teacher role assignments in their own branch.
--
-- Root cause: 20260814000001_owner_role_management.sql dropped the flat
-- "Admin can read all roles" policy and replaced it with an owner-only
-- SELECT policy, in preparation for the branch-scoped role model. However
-- 20260815000000_branch_scoped_roles.sql — which introduced branch-scoped
-- RLS for `branches` and `students` — never added an equivalent
-- branch-scoped SELECT policy for `user_roles`. Result: an admin who
-- creates a teacher via `createBranchTeacher` (assign_branch_teacher RPC)
-- cannot see that teacher afterwards — `listBranchStaff()` queries
-- `user_roles` directly and RLS silently filters out every row.
--
-- Fix: add a branch-scoped SELECT policy mirroring the existing pattern
-- used for `branches`/`students` in 20260815000000_branch_scoped_roles.sql
-- ("Admin branch-scoped write on branches" / "...on students"). An admin
-- may read teacher (and admin) role rows scoped to a branch they
-- administer. Owner-only visibility for `owner` rows is preserved —
-- unaffected by this policy since it only matches rows where the caller
-- is an admin of that exact branch_id, and owner rows always have
-- branch_id IS NULL (never matches).

BEGIN;

CREATE POLICY "Admin branch-scoped read on user_roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (
    branch_id IS NOT NULL
    AND private.has_branch_role(auth.uid(), 'admin'::public.role_enum, branch_id)
  );

COMMIT;
