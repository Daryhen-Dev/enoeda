/**
 * operational-branches — Pure helper unit tests.
 *
 * Covers:
 * - Operational role filtering (admin/teacher only, owner excluded)
 * - Active branch resolution without UUID fallback
 * - Edge cases: empty assignments, missing branches, inactive branches
 */
import { describe, it, expect } from "vitest";
import {
  getOperationalBranchIds,
  resolveActiveBranches,
  type ActiveBranchEntry,
} from "./operational-branches";
import type { AppRoleAssignment } from "./authorize";

const BRANCH_A = "aaaaaaaa-1111-2222-3333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-3333-444444444444";
const BRANCH_C = "cccccccc-1111-2222-3333-444444444444";

describe("getOperationalBranchIds", () => {
  it("returns branch IDs for admin assignments", () => {
    const assignments: AppRoleAssignment[] = [
      { role: "admin", branchId: BRANCH_A },
    ];
    expect(getOperationalBranchIds(assignments)).toEqual([BRANCH_A]);
  });

  it("returns branch IDs for teacher assignments", () => {
    const assignments: AppRoleAssignment[] = [
      { role: "teacher", branchId: BRANCH_B },
    ];
    expect(getOperationalBranchIds(assignments)).toEqual([BRANCH_B]);
  });

  it("excludes owner assignments", () => {
    const assignments: AppRoleAssignment[] = [
      { role: "owner", branchId: null },
      { role: "owner", branchId: BRANCH_A },
      { role: "admin", branchId: BRANCH_B },
    ];
    expect(getOperationalBranchIds(assignments)).toEqual([BRANCH_B]);
  });

  it("excludes assignments with null branchId", () => {
    const assignments: AppRoleAssignment[] = [
      { role: "admin", branchId: null },
      { role: "teacher", branchId: BRANCH_A },
    ];
    expect(getOperationalBranchIds(assignments)).toEqual([BRANCH_A]);
  });

  it("deduplicates branch IDs across multiple assignments", () => {
    const assignments: AppRoleAssignment[] = [
      { role: "admin", branchId: BRANCH_A },
      { role: "teacher", branchId: BRANCH_A },
      { role: "admin", branchId: BRANCH_B },
    ];
    const result = getOperationalBranchIds(assignments);
    expect(result).toHaveLength(2);
    expect(result).toContain(BRANCH_A);
    expect(result).toContain(BRANCH_B);
  });

  it("returns empty array for empty assignments", () => {
    expect(getOperationalBranchIds([])).toEqual([]);
  });

  it("returns empty array when all assignments are owner-only", () => {
    const assignments: AppRoleAssignment[] = [
      { role: "owner", branchId: null },
    ];
    expect(getOperationalBranchIds(assignments)).toEqual([]);
  });
});

describe("resolveActiveBranches", () => {
  const activeBranches: ActiveBranchEntry[] = [
    { id: BRANCH_A, name: "Main Campus", is_active: true },
    { id: BRANCH_B, name: "South Branch", is_active: true },
    { id: BRANCH_C, name: "Closed Branch", is_active: false },
  ];

  it("resolves IDs to active branches with names", () => {
    const result = resolveActiveBranches([BRANCH_A, BRANCH_B], activeBranches);
    expect(result).toEqual([
      { id: BRANCH_A, name: "Main Campus" },
      { id: BRANCH_B, name: "South Branch" },
    ]);
  });

  it("omits inactive branches (no UUID fallback)", () => {
    const result = resolveActiveBranches(
      [BRANCH_A, BRANCH_C],
      activeBranches
    );
    expect(result).toEqual([{ id: BRANCH_A, name: "Main Campus" }]);
  });

  it("omits branches not found in lookup (no UUID fallback)", () => {
    const unknownId = "dddddddd-1111-2222-3333-444444444444";
    const result = resolveActiveBranches(
      [BRANCH_A, unknownId],
      activeBranches
    );
    expect(result).toEqual([{ id: BRANCH_A, name: "Main Campus" }]);
  });

  it("returns empty array when all IDs are absent from lookup", () => {
    const unknownId = "dddddddd-1111-2222-3333-444444444444";
    const result = resolveActiveBranches([unknownId], activeBranches);
    expect(result).toEqual([]);
  });

  it("returns empty array when branch list is empty (listBranches failed)", () => {
    const result = resolveActiveBranches([BRANCH_A, BRANCH_B], []);
    expect(result).toEqual([]);
  });

  it("returns empty array when operational IDs is empty", () => {
    const result = resolveActiveBranches([], activeBranches);
    expect(result).toEqual([]);
  });

  it("omits branches with empty name", () => {
    const branchesWithEmptyName: ActiveBranchEntry[] = [
      { id: BRANCH_A, name: "", is_active: true },
      { id: BRANCH_B, name: "Valid", is_active: true },
    ];
    const result = resolveActiveBranches(
      [BRANCH_A, BRANCH_B],
      branchesWithEmptyName
    );
    expect(result).toEqual([{ id: BRANCH_B, name: "Valid" }]);
  });
});
