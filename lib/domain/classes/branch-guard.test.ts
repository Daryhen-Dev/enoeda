/**
 * Branch Guard Tests — assertClassInContext.
 *
 * Covers spec scenarios:
 * - Row missing (RLS-hidden or absent) → fail NOT_FOUND
 * - row.branch_id ≠ contextBranchId → fail BRANCH_MISMATCH
 * - row.branch_id === contextBranchId → ok
 */
import { describe, it, expect, vi } from "vitest";
import { CLASS_MESSAGES } from "@/lib/localization/es-ec";

vi.mock("server-only", () => ({}));

import { assertClassInContext } from "@/lib/domain/classes/branch-guard";

const BRANCH_A = "aaaaaaaa-1111-2222-3333-444444444444";
const BRANCH_B = "bbbbbbbb-1111-2222-3333-444444444444";
const CLASS_ID = "11111111-2222-3333-4444-555555555555";

function createMockTx(returnValue: { branch_id: string } | null) {
  return {
    scheduled_classes: {
      findUnique: vi.fn().mockResolvedValue(returnValue),
    },
  } as unknown as Parameters<typeof assertClassInContext>[0];
}

describe("assertClassInContext", () => {
  it("returns ok:false NOT_FOUND when row is missing", async () => {
    const tx = createMockTx(null);

    const result = await assertClassInContext(tx, CLASS_ID, BRANCH_A);

    expect(result).toEqual({
      ok: false,
      error: CLASS_MESSAGES.NOT_FOUND,
    });
  });

  it("returns ok:false BRANCH_MISMATCH when branch differs", async () => {
    const tx = createMockTx({ branch_id: BRANCH_B });

    const result = await assertClassInContext(tx, CLASS_ID, BRANCH_A);

    expect(result).toEqual({
      ok: false,
      error: CLASS_MESSAGES.BRANCH_MISMATCH,
    });
  });

  it("returns ok:true when branch matches context", async () => {
    const tx = createMockTx({ branch_id: BRANCH_A });

    const result = await assertClassInContext(tx, CLASS_ID, BRANCH_A);

    expect(result).toEqual({ ok: true });
  });

  it("queries scheduled_classes with correct where+select", async () => {
    const tx = createMockTx({ branch_id: BRANCH_A });

    await assertClassInContext(tx, CLASS_ID, BRANCH_A);

    expect(tx.scheduled_classes.findUnique).toHaveBeenCalledWith({
      where: { id: CLASS_ID },
      select: { branch_id: true },
    });
  });
});
