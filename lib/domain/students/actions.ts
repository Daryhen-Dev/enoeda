"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  assertCallerBranchContext,
  BRANCH_ASSERTION_MESSAGES,
} from "@/lib/auth/branch-assertion";
import { COMMON_MESSAGES, STUDENT_MESSAGES } from "@/lib/localization/es-ec";
import {
  STUDENT_STATUS,
  studentCreateSchema,
  studentIdSchema,
  studentListSchema,
  studentReactivateSchema,
  studentUpdateSchema,
  type StudentCreateInput,
  type StudentListInput,
  type StudentReactivateInput,
  type StudentUpdateInput,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const STUDENT_NOT_FOUND_ERROR = STUDENT_MESSAGES.NOT_FOUND;
const ACTIVE_STUDENT_BRANCH_ERROR =
  STUDENT_MESSAGES.ACTIVE_STUDENT_BRANCH_REQUIRED;
const REACTIVATION_BRANCH_ERROR =
  STUDENT_MESSAGES.REACTIVATION_BRANCH_REQUIRED;
const OPERATION_FAILED_ERROR = COMMON_MESSAGES.UNEXPECTED_ERROR;

interface StudentMutationOutcome {
  id: string | null;
  error: string | null;
}

export interface StudentProfile {
  id: string;
  branch_id: string;
  first_name: string;
  surname: string;
  national_id: string;
  email: string;
  date_of_birth: Date;
  is_active: boolean;
}

export interface StudentListItem {
  id: string;
  branch_id: string;
  branch_name: string;
  first_name: string;
  surname: string;
  active_discipline_names: string[];
  is_active: boolean;
}

export interface StudentListPage {
  items: StudentListItem[];
  next_cursor: string | null;
}

export async function listStudents(
  input: unknown = {}
): Promise<ActionResult<StudentListPage>> {
  const parsed = studentListSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const listInput: StudentListInput = parsed.data;
  const result = await withAuthenticatedUser(async (tx, ctx) => {
    // Branch context assertion: caller must have active assignment
    const branchError = assertCallerBranchContext(ctx, listInput.branch_id);
    if (branchError) {
      return { __branchError: branchError } as const;
    }

    return tx.students.findMany({
      take: listInput.page_size + 1,
      where: {
        is_active: listInput.status === STUDENT_STATUS.ACTIVE,
        branch_id: listInput.branch_id,
      },
      orderBy: [
        { surname: "asc" },
        { first_name: "asc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        branch_id: true,
        first_name: true,
        surname: true,
        is_active: true,
        branches: { select: { name: true } },
        student_disciplines: {
          where: { is_active: true },
          select: { disciplines: { select: { name: true } } },
        },
      },
      ...(listInput.cursor === undefined
        ? {}
        : { cursor: { id: listInput.cursor }, skip: 1 }),
    });
  });

  if (!result.success) return result;

  // Handle branch assertion failure
  if ("__branchError" in result.data) {
    return { success: false, error: result.data.__branchError };
  }

  const rows = result.data as Exclude<typeof result.data, { __branchError: string }>;
  const hasExtraItem = rows.length > listInput.page_size;
  const items = rows.slice(0, listInput.page_size).map((student) => ({
    id: student.id,
    branch_id: student.branch_id,
    branch_name: student.branches.name,
    first_name: student.first_name,
    surname: student.surname,
    active_discipline_names: student.student_disciplines
      .map((studentDiscipline) => studentDiscipline.disciplines.name)
      .sort((firstName, secondName) => firstName.localeCompare(secondName)),
    is_active: student.is_active,
  }));
  const lastItem = items.at(-1);

  return {
    success: true,
    data: {
      items,
      next_cursor:
        hasExtraItem && lastItem !== undefined ? lastItem.id : null,
    },
  };
}

export interface ActiveStudentCount {
  count: number;
}

export async function getActiveStudentCount(): Promise<
  ActionResult<ActiveStudentCount>
> {
  const result = await withAuthenticatedUser(async (tx) => {
    return tx.students.count({ where: { is_active: true } });
  });

  if (!result.success) return result;

  return { success: true, data: { count: result.data } };
}

export async function getStudentById(
  id: string,
  branchId: string
): Promise<ActionResult<StudentProfile>> {
  const parsed = studentIdSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  if (!branchId) {
    return { success: false, error: BRANCH_ASSERTION_MESSAGES.MISSING_BRANCH_CONTEXT };
  }

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    // Assert caller has active assignment for this branch
    const branchError = assertCallerBranchContext(ctx, branchId);
    if (branchError) {
      return { __branchError: branchError } as const;
    }

    return tx.students.findUnique({
      where: { id: parsed.data },
      select: {
        id: true,
        branch_id: true,
        first_name: true,
        surname: true,
        national_id: true,
        email: true,
        date_of_birth: true,
        is_active: true,
      },
    });
  });

  if (!result.success) return result;

  if (result.data === null) {
    return { success: false, error: STUDENT_NOT_FOUND_ERROR };
  }

  if ("__branchError" in result.data) {
    return { success: false, error: (result.data as { __branchError: string }).__branchError };
  }

  const student = result.data as Exclude<typeof result.data, { __branchError: string } | null>;
  if (student === null) {
    return { success: false, error: STUDENT_NOT_FOUND_ERROR };
  }

  // Branch ownership validation — fail-closed
  if (student.branch_id !== branchId) {
    return { success: false, error: STUDENT_NOT_FOUND_ERROR };
  }

  return {
    success: true,
    data: {
      id: student.id,
      branch_id: student.branch_id,
      first_name: student.first_name,
      surname: student.surname,
      national_id: student.national_id,
      email: student.email,
      date_of_birth: student.date_of_birth,
      is_active: student.is_active,
    },
  };
}

/**
 * Create a new student. Admin or Teacher (RLS enforced).
 * Teacher restricted to their own branch via app-layer check (A6)
 * as defense-in-depth on top of RLS WITH CHECK.
 * Identity derived server-side via withAuthenticatedUser.
 * Transaction failures are intentionally redacted by the executor.
 */
export async function createStudent(
  input: StudentCreateInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = studentCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    // Branch context assertion: caller must have active assignment for target branch
    const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
    if (branchError) {
      return {
        id: null,
        error: branchError,
      } satisfies StudentMutationOutcome;
    }

    // A6: Teacher-only branch check (defense-in-depth)
    const isTeacher = ctx.roles.includes("teacher");
    const isAdminOrOwner = ctx.roles.some(
      (r) => r === "admin" || r === "owner"
    );
    if (isTeacher && !isAdminOrOwner) {
      const teacherBranchIds = ctx.assignments
        .filter((a) => a.role === "teacher" && a.branchId)
        .map((a) => a.branchId);
      if (!teacherBranchIds.includes(parsed.data.branch_id)) {
        return {
          id: null,
          error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS,
        } satisfies StudentMutationOutcome;
      }
    }

    if (parsed.data.is_active) {
      const branch = await tx.branches.findUnique({
        where: { id: parsed.data.branch_id },
        select: { id: true, is_active: true },
      });

      if (branch === null || !branch.is_active) {
        return {
          id: null,
          error: ACTIVE_STUDENT_BRANCH_ERROR,
        } satisfies StudentMutationOutcome;
      }
    }

    const student = await tx.students.create({
      data: {
        branch_id: parsed.data.branch_id,
        first_name: parsed.data.first_name,
        surname: parsed.data.surname,
        national_id: parsed.data.national_id,
        email: parsed.data.email,
        date_of_birth: new Date(parsed.data.date_of_birth),
        is_active: parsed.data.is_active,
      },
      select: { id: true },
    });

    return { id: student.id, error: null } satisfies StudentMutationOutcome;
  });

  if (!result.success) return result;
  if (result.data.id === null) {
    return {
      success: false,
      error: result.data.error ?? OPERATION_FAILED_ERROR,
    };
  }

  return { success: true, data: { id: result.data.id } };
}

export async function updateStudent(
  input: StudentUpdateInput,
  branchId?: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = studentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  // Branch context is required for defense-in-depth
  if (!branchId) {
    return { success: false, error: BRANCH_ASSERTION_MESSAGES.MISSING_BRANCH_CONTEXT };
  }

  const { id, ...editableFields } = parsed.data;

  // Prevent cross-branch transfer via raw branch_id field
  if (editableFields.branch_id !== undefined && editableFields.branch_id !== branchId) {
    return { success: false, error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED };
  }

  const data = {
    ...(editableFields.branch_id === undefined
      ? {}
      : { branch_id: editableFields.branch_id }),
    ...(editableFields.first_name === undefined
      ? {}
      : { first_name: editableFields.first_name }),
    ...(editableFields.surname === undefined
      ? {}
      : { surname: editableFields.surname }),
    ...(editableFields.national_id === undefined
      ? {}
      : { national_id: editableFields.national_id }),
    ...(editableFields.email === undefined ? {} : { email: editableFields.email }),
    ...(editableFields.date_of_birth === undefined
      ? {}
      : { date_of_birth: new Date(editableFields.date_of_birth) }),
  };

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    // Assert caller has active assignment for this branch
    const ctxError = assertCallerBranchContext(ctx, branchId);
    if (ctxError) {
      return {
        id: null,
        error: ctxError,
      } satisfies StudentMutationOutcome;
    }

    const student = await tx.students.findUnique({
      where: { id },
      select: { id: true, branch_id: true, is_active: true },
    });

    if (student === null) {
      return {
        id: null,
        error: STUDENT_NOT_FOUND_ERROR,
      } satisfies StudentMutationOutcome;
    }

    // Cross-branch guard: student must belong to the caller's branch
    if (student.branch_id !== branchId) {
      return {
        id: null,
        error: STUDENT_NOT_FOUND_ERROR,
      } satisfies StudentMutationOutcome;
    }

    if (student.is_active && editableFields.branch_id !== undefined) {
      const branch = await tx.branches.findUnique({
        where: { id: editableFields.branch_id },
        select: { id: true, is_active: true },
      });

      if (branch === null || !branch.is_active) {
        return {
          id: null,
          error: ACTIVE_STUDENT_BRANCH_ERROR,
        } satisfies StudentMutationOutcome;
      }
    }

    const updatedStudent = await tx.students.update({
      where: { id },
      data,
      select: { id: true },
    });

    return {
      id: updatedStudent.id,
      error: null,
    } satisfies StudentMutationOutcome;
  });

  if (!result.success) return result;
  if (result.data.id === null) {
    return {
      success: false,
      error: result.data.error ?? OPERATION_FAILED_ERROR,
    };
  }

  return { success: true, data: { id: result.data.id } };
}

export async function deactivateStudent(
  id: string,
  branchId: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = studentIdSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  if (!branchId) {
    return { success: false, error: BRANCH_ASSERTION_MESSAGES.MISSING_BRANCH_CONTEXT };
  }

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    // Assert caller has active assignment for this branch
    const branchError = assertCallerBranchContext(ctx, branchId);
    if (branchError) {
      return { __branchError: branchError } as const;
    }

    const student = await tx.students.findUnique({
      where: { id },
      select: { id: true, branch_id: true, is_active: true },
    });

    if (student === null) return null;

    // Cross-branch guard
    if (student.branch_id !== branchId) return null;

    if (!student.is_active) return { id: student.id };

    return tx.students.update({
      where: { id },
      data: { is_active: false },
      select: { id: true },
    });
  });

  if (!result.success) return result;

  if (result.data !== null && "__branchError" in result.data) {
    return { success: false, error: result.data.__branchError };
  }

  if (result.data === null) {
    return { success: false, error: STUDENT_NOT_FOUND_ERROR };
  }

  return { success: true, data: { id: result.data.id } };
}


export async function reactivateStudent(
  input: StudentReactivateInput,
  callerBranchId?: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = studentReactivateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  if (!callerBranchId) {
    return { success: false, error: BRANCH_ASSERTION_MESSAGES.MISSING_BRANCH_CONTEXT };
  }

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    // Assert caller has active assignment for branch
    const ctxError = assertCallerBranchContext(ctx, callerBranchId);
    if (ctxError) {
      return {
        id: null,
        error: ctxError,
      } satisfies StudentMutationOutcome;
    }

    const student = await tx.students.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, branch_id: true, is_active: true },
    });

    if (student === null) {
      return {
        id: null,
        error: STUDENT_NOT_FOUND_ERROR,
      } satisfies StudentMutationOutcome;
    }

    // Student must be visible in caller's branch context
    if (student.branch_id !== callerBranchId) {
      return {
        id: null,
        error: STUDENT_NOT_FOUND_ERROR,
      } satisfies StudentMutationOutcome;
    }

    if (student.is_active) {
      const branch = await tx.branches.findUnique({
        where: { id: student.branch_id },
        select: { id: true, is_active: true },
      });

      if (branch === null || !branch.is_active) {
        return {
          id: null,
          error: ACTIVE_STUDENT_BRANCH_ERROR,
        } satisfies StudentMutationOutcome;
      }

      return { id: student.id, error: null } satisfies StudentMutationOutcome;
    }

    const branchId = parsed.data.branch_id ?? student.branch_id;

    // Prevent cross-branch reactivation to a different branch
    if (branchId !== callerBranchId) {
      return {
        id: null,
        error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED,
      } satisfies StudentMutationOutcome;
    }

    const branch = await tx.branches.findUnique({
      where: { id: branchId },
      select: { id: true, is_active: true },
    });

    if (branch === null || !branch.is_active) {
      return {
        id: null,
        error: REACTIVATION_BRANCH_ERROR,
      } satisfies StudentMutationOutcome;
    }

    const reactivatedStudent = await tx.students.update({
      where: { id: student.id },
      data: {
        is_active: true,
        ...(branchId === student.branch_id ? {} : { branch_id: branchId }),
      },
      select: { id: true },
    });

    return {
      id: reactivatedStudent.id,
      error: null,
    } satisfies StudentMutationOutcome;
  });

  if (!result.success) return result;
  if (result.data.id === null) {
    return {
      success: false,
      error: result.data.error ?? OPERATION_FAILED_ERROR,
    };
  }

  return { success: true, data: { id: result.data.id } };
}
