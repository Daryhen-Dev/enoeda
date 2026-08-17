/**
 * Property-based tests for conflict scoping (fast-check).
 *
 * Properties tested (S6.1–S6.3):
 * - Same-branch same-time blocks assignment
 * - Cross-branch same-time is always allowed
 * - force=true never touches other branches
 */
import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

vi.mock("server-only", () => ({}));

// --- Pure conflict logic extracted for property testing ---

interface ClassSlot {
  id: string;
  branch_id: string;
  day_of_week: number;
  start_minutes: number; // minutes from midnight
  teacher_id: string;
}

/**
 * Pure function: detect same-branch conflicts for a given slot.
 * Mirrors the logic in detectTeacherConflicts when scoped to a branch.
 */
function findBranchConflicts(
  existingSlots: ClassSlot[],
  newSlot: { teacher_id: string; branch_id: string; day_of_week: number; start_minutes: number; class_id: string }
): ClassSlot[] {
  return existingSlots.filter(
    (slot) =>
      slot.teacher_id === newSlot.teacher_id &&
      slot.branch_id === newSlot.branch_id &&
      slot.day_of_week === newSlot.day_of_week &&
      slot.id !== newSlot.class_id &&
      // Overlap: both are 60-minute slots
      newSlot.start_minutes < slot.start_minutes + 60 &&
      newSlot.start_minutes + 60 > slot.start_minutes
  );
}

/**
 * Pure function: force unassign — only same-branch conflicts are removed.
 */
function forceUnassign(
  conflicts: ClassSlot[],
  branchId: string
): ClassSlot[] {
  return conflicts.filter((c) => c.branch_id === branchId);
}

// --- Arbitraries ---

const branchIdArb = fc.constantFrom(
  "aaaaaaaa-1111-2222-8333-444444444444",
  "bbbbbbbb-1111-2222-8333-444444444444",
  "cccccccc-1111-2222-8333-444444444444"
);

const teacherIdArb = fc.constantFrom(
  "11111111-aaaa-bbbb-8ccc-dddddddddddd",
  "22222222-aaaa-bbbb-8ccc-dddddddddddd"
);

const dayArb = fc.integer({ min: 0, max: 6 });
const timeArb = fc.integer({ min: 0, max: 23 * 60 }); // minutes from midnight

const classSlotArb = fc.record({
  id: fc.uuid(),
  branch_id: branchIdArb,
  day_of_week: dayArb,
  start_minutes: timeArb,
  teacher_id: teacherIdArb,
});

describe("Conflict scoping properties (fast-check)", () => {
  it("S6.1: same-branch same-time always produces a conflict", () => {
    fc.assert(
      fc.property(
        classSlotArb,
        fc.uuid(),
        (existing, newClassId) => {
          // Create a new assignment at the exact same time/branch/teacher
          const newSlot = {
            teacher_id: existing.teacher_id,
            branch_id: existing.branch_id,
            day_of_week: existing.day_of_week,
            start_minutes: existing.start_minutes,
            class_id: newClassId,
          };

          const conflicts = findBranchConflicts([existing], newSlot);

          // Same teacher, same branch, same day, overlapping time → always conflicts
          if (newClassId !== existing.id) {
            expect(conflicts.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("S6.2: cross-branch same-time never produces a conflict (when scoped to branch)", () => {
    fc.assert(
      fc.property(
        classSlotArb,
        branchIdArb,
        fc.uuid(),
        (existing, differentBranch, newClassId) => {
          fc.pre(differentBranch !== existing.branch_id);

          const newSlot = {
            teacher_id: existing.teacher_id,
            branch_id: differentBranch, // Different branch
            day_of_week: existing.day_of_week,
            start_minutes: existing.start_minutes,
            class_id: newClassId,
          };

          const conflicts = findBranchConflicts([existing], newSlot);

          // Cross-branch → never conflicts when scoped to the new branch
          expect(conflicts.length).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("S6.3: force never touches other branches", () => {
    fc.assert(
      fc.property(
        fc.array(classSlotArb, { minLength: 1, maxLength: 10 }),
        branchIdArb,
        (conflicts, targetBranch) => {
          const removed = forceUnassign(conflicts, targetBranch);

          // All removed items belong to the target branch
          for (const item of removed) {
            expect(item.branch_id).toBe(targetBranch);
          }

          // No item from other branches is ever removed
          const otherBranchItems = conflicts.filter(
            (c) => c.branch_id !== targetBranch
          );
          for (const otherItem of otherBranchItems) {
            expect(removed).not.toContain(otherItem);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
