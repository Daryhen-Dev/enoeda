/**
 * Branch-Scoped Roles Migration Test: Structural and contract validation
 * Verifies the migration SQL artifact contains all required branch-scoped
 * role hierarchy structures per the design document.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const migrationPath = resolve(
  __dirname,
  "20260815000000_branch_scoped_roles.sql"
);
const sql = readFileSync(migrationPath, "utf-8");

describe("Branch-Scoped Roles Migration — Structural Validation", () => {
  describe("1.1 branch_id FK column", () => {
    it("adds branch_id uuid column referencing branches", () => {
      expect(sql).toContain("ADD COLUMN branch_id uuid");
      expect(sql).toContain("REFERENCES public.branches(id)");
    });

    it("creates index on branch_id", () => {
      expect(sql).toContain("user_roles_branch_id_idx");
      expect(sql).toContain("(branch_id)");
    });
  });

  describe("1.2 CHECK constraint", () => {
    it("enforces owner ⇒ branch_id NULL, admin/teacher ⇒ branch_id NOT NULL", () => {
      expect(sql).toContain("user_roles_branch_scope_ck");
      expect(sql).toMatch(/role\s*=\s*'owner'[\s\S]*AND\s*branch_id\s+IS\s+NULL/);
      expect(sql).toMatch(
        /role\s+IN\s*\('admin'[\s\S]*'teacher'[\s\S]*\)\s*AND\s*branch_id\s+IS\s+NOT\s+NULL/
      );
    });

    it("uses NOT VALID + separate VALIDATE for migration safety", () => {
      expect(sql).toContain("NOT VALID");
      expect(sql).toContain("VALIDATE CONSTRAINT user_roles_branch_scope_ck");
    });
  });

  describe("1.3 Active-uniqueness index", () => {
    it("drops old user_roles_active_uq index", () => {
      expect(sql).toContain("DROP INDEX IF EXISTS public.user_roles_active_uq");
    });

    it("creates new (user_id, role, branch_id) WHERE revoked_at IS NULL", () => {
      expect(sql).toMatch(
        /CREATE UNIQUE INDEX user_roles_active_uq\s+ON public\.user_roles\s*\(user_id,\s*role,\s*branch_id\)\s+WHERE revoked_at IS NULL/
      );
    });

    it("preserves single-active-owner index", () => {
      expect(sql).toContain("uq_user_roles_single_active_owner");
    });
  });

  describe("1.4 private.has_branch_role helper", () => {
    it("creates the function", () => {
      expect(sql).toContain("private.has_branch_role");
    });

    it("accepts uid, role, branch_id params", () => {
      expect(sql).toMatch(
        /has_branch_role\(\s*p_user_id uuid,\s*p_role public\.role_enum,\s*p_branch_id uuid\s*\)/
      );
    });

    it("returns boolean", () => {
      expect(sql).toMatch(/has_branch_role[\s\S]*RETURNS boolean/);
    });

    it("checks user_id + role + branch_id + revoked_at IS NULL", () => {
      // Within the has_branch_role function body
      const fnMatch = sql.match(
        /has_branch_role[\s\S]*?RETURNS boolean[\s\S]*?\$\$[\s\S]*?user_id\s*=\s*p_user_id[\s\S]*?role\s*=\s*p_role[\s\S]*?branch_id\s*=\s*p_branch_id[\s\S]*?revoked_at\s+IS\s+NULL/
      );
      expect(fnMatch).not.toBeNull();
    });

    it("is SECURITY DEFINER with empty search_path", () => {
      expect(sql).toMatch(
        /has_branch_role[\s\S]*?SECURITY DEFINER[\s\S]*?search_path\s*=\s*''/
      );
    });
  });

  describe("1.5 private.has_any_admin_role helper", () => {
    it("creates the function", () => {
      expect(sql).toContain("private.has_any_admin_role");
    });

    it("checks for any active admin role regardless of branch", () => {
      expect(sql).toMatch(
        /has_any_admin_role[\s\S]*?role\s*=\s*'admin'::public\.role_enum[\s\S]*?revoked_at\s+IS\s+NULL/
      );
    });
  });

  describe("1.6 assign_branch_admin RPC", () => {
    it("creates the function", () => {
      expect(sql).toContain("assign_branch_admin");
    });

    it("requires owner authorization", () => {
      expect(sql).toMatch(
        /assign_branch_admin[\s\S]*?has_role\(auth\.uid\(\),\s*'owner'::public\.role_enum\)/
      );
    });

    it("validates target exists in auth.users", () => {
      expect(sql).toMatch(
        /assign_branch_admin[\s\S]*?FROM auth\.users WHERE id = p_target/
      );
    });

    it("inserts with role=admin and specified branch_id", () => {
      expect(sql).toMatch(
        /assign_branch_admin[\s\S]*?'admin'::public\.role_enum,\s*p_branch_id/
      );
    });

    it("is idempotent via ON CONFLICT DO NOTHING", () => {
      expect(sql).toMatch(
        /assign_branch_admin[\s\S]*?ON CONFLICT[\s\S]*?DO NOTHING/
      );
    });

    it("grants execute only to authenticated", () => {
      expect(sql).toMatch(
        /GRANT EXECUTE ON FUNCTION public\.assign_branch_admin[\s\S]*?TO authenticated/
      );
    });
  });

  describe("1.7 assign_branch_teacher RPC", () => {
    it("creates the function", () => {
      expect(sql).toContain("assign_branch_teacher");
    });

    it("requires admin-of-branch authorization", () => {
      expect(sql).toMatch(
        /assign_branch_teacher[\s\S]*?has_branch_role\(auth\.uid\(\),\s*'admin'::public\.role_enum,\s*p_branch_id\)/
      );
    });

    it("validates target exists in auth.users", () => {
      expect(sql).toMatch(
        /assign_branch_teacher[\s\S]*?FROM auth\.users WHERE id = p_target/
      );
    });

    it("inserts with role=teacher and specified branch_id", () => {
      expect(sql).toMatch(
        /assign_branch_teacher[\s\S]*?'teacher'::public\.role_enum,\s*p_branch_id/
      );
    });
  });

  describe("1.8 revoke_branch_role RPC", () => {
    it("creates the function", () => {
      expect(sql).toContain("revoke_branch_role");
    });

    it("rejects revoking owner role", () => {
      expect(sql).toMatch(
        /revoke_branch_role[\s\S]*?p_role\s*=\s*'owner'::public\.role_enum[\s\S]*?RAISE EXCEPTION/
      );
    });

    it("owner can revoke any branch role", () => {
      expect(sql).toMatch(
        /revoke_branch_role[\s\S]*?has_role\(auth\.uid\(\),\s*'owner'::public\.role_enum\)/
      );
    });

    it("admin can revoke teacher in own branch only", () => {
      expect(sql).toMatch(
        /revoke_branch_role[\s\S]*?has_branch_role\(auth\.uid\(\),\s*'admin'::public\.role_enum,\s*p_branch_id\)/
      );
      expect(sql).toMatch(
        /revoke_branch_role[\s\S]*?admin can only revoke teacher/
      );
    });

    it("soft-revokes by setting revoked_by and revoked_at", () => {
      expect(sql).toMatch(
        /revoke_branch_role[\s\S]*?SET revoked_by = auth\.uid\(\),\s*revoked_at = now\(\)/
      );
    });
  });

  describe("1.9 current_roles() → TABLE(role, branch_id)", () => {
    it("drops old current_roles function", () => {
      expect(sql).toContain("DROP FUNCTION IF EXISTS public.current_roles()");
    });

    it("creates new current_roles returning TABLE(role, branch_id)", () => {
      expect(sql).toMatch(
        /CREATE FUNCTION public\.current_roles\(\)\s*\nRETURNS TABLE\(role public\.role_enum,\s*branch_id uuid\)/
      );
    });

    it("filters by auth.uid() and active rows", () => {
      expect(sql).toMatch(
        /current_roles[\s\S]*?user_id = auth\.uid\(\)\s+AND\s+.*revoked_at IS NULL/
      );
    });
  });

  describe("1.10 Branch RLS rewrite", () => {
    it("drops old flat admin/teacher policies on branches", () => {
      expect(sql).toContain(
        'DROP POLICY IF EXISTS "Admin full access on branches"'
      );
      expect(sql).toContain(
        'DROP POLICY IF EXISTS "Teacher read branches"'
      );
    });

    it("creates owner full access policy", () => {
      expect(sql).toContain("Owner full access on branches");
    });

    it("creates admin branch-scoped write policy", () => {
      expect(sql).toContain("Admin branch-scoped write on branches");
      expect(sql).toMatch(
        /Admin branch-scoped write on branches[\s\S]*?has_branch_role\(auth\.uid\(\),\s*'admin'::public\.role_enum,\s*id\)/
      );
    });

    it("creates admin global read policy via has_any_admin_role", () => {
      expect(sql).toContain("Admin global read on branches");
      expect(sql).toMatch(
        /Admin global read on branches[\s\S]*?has_any_admin_role\(auth\.uid\(\)\)/
      );
    });

    it("creates teacher branch-scoped read policy", () => {
      expect(sql).toContain("Teacher branch-scoped read on branches");
      expect(sql).toMatch(
        /Teacher branch-scoped read on branches[\s\S]*?has_branch_role\(auth\.uid\(\),\s*'teacher'::public\.role_enum,\s*id\)/
      );
    });
  });

  describe("1.11 Student RLS rewrite", () => {
    it("drops old flat policies on students", () => {
      expect(sql).toContain(
        'DROP POLICY IF EXISTS "Admin full access on students"'
      );
      expect(sql).toContain(
        'DROP POLICY IF EXISTS "Teacher read students"'
      );
    });

    it("creates owner full access policy on students", () => {
      expect(sql).toContain("Owner full access on students");
    });

    it("creates admin branch-scoped write using branch_id column", () => {
      expect(sql).toContain("Admin branch-scoped write on students");
      expect(sql).toMatch(
        /Admin branch-scoped write on students[\s\S]*?has_branch_role\(auth\.uid\(\),\s*'admin'::public\.role_enum,\s*branch_id\)/
      );
    });

    it("creates admin global read on students", () => {
      expect(sql).toContain("Admin global read on students");
      expect(sql).toMatch(
        /Admin global read on students[\s\S]*?has_any_admin_role\(auth\.uid\(\)\)/
      );
    });

    it("creates teacher branch-scoped read on students using branch_id", () => {
      expect(sql).toContain("Teacher branch-scoped read on students");
      expect(sql).toMatch(
        /Teacher branch-scoped read on students[\s\S]*?has_branch_role\(auth\.uid\(\),\s*'teacher'::public\.role_enum,\s*branch_id\)/
      );
    });
  });

  describe("Superseded RPCs dropped", () => {
    it("drops grant_role", () => {
      expect(sql).toContain("DROP FUNCTION IF EXISTS public.grant_role");
    });

    it("drops revoke_role", () => {
      expect(sql).toContain("DROP FUNCTION IF EXISTS public.revoke_role");
    });

    it("drops list_staff", () => {
      expect(sql).toContain("DROP FUNCTION IF EXISTS public.list_staff()");
    });
  });

  describe("Transactional safety", () => {
    it("wraps in BEGIN/COMMIT", () => {
      expect(sql.trimStart()).toMatch(/^--[\s\S]*?BEGIN;/);
      expect(sql.trimEnd()).toMatch(/COMMIT;\s*$/);
    });
  });
});
