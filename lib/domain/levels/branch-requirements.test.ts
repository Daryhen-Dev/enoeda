import { describe, expect, it } from "vitest";

import {
  buildBranchRequirementMap,
  resolveRequiredSessions,
} from "./branch-requirements";

const BRANCH_A = "a0000000-0000-4000-8000-000000000001";
const BRANCH_B = "a0000000-0000-4000-8000-000000000002";
const LEVEL_1 = "d3333333-3333-4333-8333-333333333331";
const LEVEL_2 = "d3333333-3333-4333-8333-333333333332";

describe("resolveRequiredSessions", () => {
  it("returns the override when present", () => {
    expect(resolveRequiredSessions(10, 4)).toBe(4);
  });

  it("returns the general value without an override", () => {
    expect(resolveRequiredSessions(10, null)).toBe(10);
    expect(resolveRequiredSessions(10, undefined)).toBe(10);
  });

  it("keeps zero-value overrides (a branch may require zero sessions)", () => {
    expect(resolveRequiredSessions(10, 0)).toBe(0);
  });
});

describe("buildBranchRequirementMap", () => {
  it("indexes overrides by level_id", () => {
    const map = buildBranchRequirementMap(
      [
        { branch_id: BRANCH_A, level_id: LEVEL_1, required_attended_sessions: 4 },
        { branch_id: BRANCH_A, level_id: LEVEL_2, required_attended_sessions: 8 },
      ],
      BRANCH_A
    );
    expect(map.get(LEVEL_1)).toBe(4);
    expect(map.get(LEVEL_2)).toBe(8);
  });

  it("ignores overrides that belong to another branch", () => {
    const map = buildBranchRequirementMap(
      [
        { branch_id: BRANCH_B, level_id: LEVEL_1, required_attended_sessions: 99 },
      ],
      BRANCH_A
    );
    expect(map.has(LEVEL_1)).toBe(false);
  });

  it("returns an empty map for empty rows", () => {
    expect(buildBranchRequirementMap([], BRANCH_A).size).toBe(0);
  });
});
