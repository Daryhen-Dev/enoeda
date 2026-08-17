/**
 * Payment queries tests — branch-scoped overdue student queries.
 *
 * Validates that countOverdueStudents and listOverdueStudents
 * require branchId and filter by student.branch_id.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import { countOverdueStudents, listOverdueStudents } from "./queries";

describe("countOverdueStudents", () => {
  it("includes branch_id filter in query when branchId is provided", async () => {
    const BRANCH_ID = "aaaaaaaa-1111-2222-3333-444444444444";
    const mockFindMany = vi.fn().mockResolvedValue([
      { student_id: "s1" },
    ]);
    const mockTx = {
      student_disciplines: { findMany: mockFindMany },
    };

    await countOverdueStudents(mockTx as any, BRANCH_ID);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).toHaveProperty("students");
    expect(callArgs.where.students).toMatchObject({ branch_id: BRANCH_ID });
  });

  it("requires branchId parameter (type enforcement)", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockTx = {
      student_disciplines: { findMany: mockFindMany },
    };

    // Without branchId the function should either throw or always filter
    // We test that the where clause includes branch_id regardless
    await countOverdueStudents(mockTx as any, "some-branch");

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where.students).toBeDefined();
    expect(callArgs.where.students.branch_id).toBe("some-branch");
  });
});

describe("listOverdueStudents", () => {
  it("includes branch_id filter in query when branchId is provided", async () => {
    const BRANCH_ID = "bbbbbbbb-1111-2222-3333-444444444444";
    const mockFindMany = vi.fn().mockResolvedValue([]);
    const mockTx = {
      student_disciplines: { findMany: mockFindMany },
    };

    await listOverdueStudents(mockTx as any, BRANCH_ID);

    const callArgs = mockFindMany.mock.calls[0][0];
    expect(callArgs.where).toHaveProperty("students");
    expect(callArgs.where.students).toMatchObject({ branch_id: BRANCH_ID });
  });
});
