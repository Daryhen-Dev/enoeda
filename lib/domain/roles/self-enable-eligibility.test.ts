/**
 * Self-Enable Teacher Eligibility Tests — Correction A.
 *
 * Validates that the self-enable action only shows on the correct row:
 * - currentUserId + role=admin + branchId match
 * - Not already a teacher in that branch
 * - Must NOT enable another administrator
 */
import { describe, it, expect } from "vitest";

import { isSelfEnableEligibleRow } from "./self-enable-eligibility";

const CURRENT_USER = "user-admin-1";
const OTHER_USER = "user-admin-2";
const BRANCH = "branch-1";
const OTHER_BRANCH = "branch-2";

describe("isSelfEnableEligibleRow", () => {
  it("returns true for current user's admin row when not already teacher", () => {
    const row = { user_id: CURRENT_USER, role: "admin", branch_id: BRANCH };
    const allAssignments = [row];

    const result = isSelfEnableEligibleRow(row, CURRENT_USER, BRANCH, allAssignments);
    expect(result).toBe(true);
  });

  it("returns false for another admin's row (must not enable another admin)", () => {
    const row = { user_id: OTHER_USER, role: "admin", branch_id: BRANCH };
    const allAssignments = [
      row,
      { user_id: CURRENT_USER, role: "admin", branch_id: BRANCH },
    ];

    const result = isSelfEnableEligibleRow(row, CURRENT_USER, BRANCH, allAssignments);
    expect(result).toBe(false);
  });

  it("returns false when current user already has teacher role in branch", () => {
    const row = { user_id: CURRENT_USER, role: "admin", branch_id: BRANCH };
    const allAssignments = [
      row,
      { user_id: CURRENT_USER, role: "teacher", branch_id: BRANCH },
    ];

    const result = isSelfEnableEligibleRow(row, CURRENT_USER, BRANCH, allAssignments);
    expect(result).toBe(false);
  });

  it("returns false for teacher rows (only admin rows qualify)", () => {
    const row = { user_id: CURRENT_USER, role: "teacher", branch_id: BRANCH };
    const allAssignments = [row];

    const result = isSelfEnableEligibleRow(row, CURRENT_USER, BRANCH, allAssignments);
    expect(result).toBe(false);
  });

  it("returns false for admin row in a different branch", () => {
    const row = { user_id: CURRENT_USER, role: "admin", branch_id: OTHER_BRANCH };
    const allAssignments = [row];

    const result = isSelfEnableEligibleRow(row, CURRENT_USER, BRANCH, allAssignments);
    expect(result).toBe(false);
  });

  it("is eligible when teacher role exists in different branch", () => {
    const row = { user_id: CURRENT_USER, role: "admin", branch_id: BRANCH };
    const allAssignments = [
      row,
      { user_id: CURRENT_USER, role: "teacher", branch_id: OTHER_BRANCH },
    ];

    const result = isSelfEnableEligibleRow(row, CURRENT_USER, BRANCH, allAssignments);
    expect(result).toBe(true);
  });
});
