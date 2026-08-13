"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
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
  first_name: string;
  surname: string;
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
  const result = await withAuthenticatedUser(async (tx) => {
    return tx.students.findMany({
      take: listInput.page_size + 1,
      where: {
        is_active: listInput.status === STUDENT_STATUS.ACTIVE,
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
      },
      ...(listInput.cursor === undefined
        ? {}
        : { cursor: { id: listInput.cursor }, skip: 1 }),
    });
  });

  if (!result.success) return result;

  const hasExtraItem = result.data.length > listInput.page_size;
  const items = result.data.slice(0, listInput.page_size);
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
  id: string
): Promise<ActionResult<StudentProfile>> {
  const parsed = studentIdSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(async (tx) => {
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
    return { success: false, error: "Student not found" };
  }

  return {
    success: true,
    data: {
      id: result.data.id,
      branch_id: result.data.branch_id,
      first_name: result.data.first_name,
      surname: result.data.surname,
      national_id: result.data.national_id,
      email: result.data.email,
      date_of_birth: result.data.date_of_birth,
      is_active: result.data.is_active,
    },
  };
}

/**
 * Create a new student. Admin-only (RLS enforced).
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

  const result = await withAuthenticatedUser(async (tx) => {
    return tx.students.create({
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
  });

  if (!result.success) return result;
  return { success: true, data: { id: result.data.id } };
}

export async function updateStudent(
  input: StudentUpdateInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = studentUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { id, ...editableFields } = parsed.data;
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

  const result = await withAuthenticatedUser(async (tx) => {
    const student = await tx.students.findUnique({
      where: { id },
      select: { id: true },
    });

    if (student === null) return null;

    return tx.students.update({
      where: { id },
      data,
      select: { id: true },
    });
  });

  if (!result.success) return result;
  if (result.data === null) {
    return { success: false, error: "Student not found" };
  }

  return { success: true, data: { id: result.data.id } };
}

export async function deactivateStudent(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const parsed = studentIdSchema.safeParse(id);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(async (tx) => {
    const student = await tx.students.findUnique({
      where: { id },
      select: { id: true, is_active: true },
    });

    if (student === null) return null;
    if (!student.is_active) return { id: student.id };

    return tx.students.update({
      where: { id },
      data: { is_active: false },
      select: { id: true },
    });
  });

  if (!result.success) return result;
  if (result.data === null) {
    return { success: false, error: "Student not found" };
  }

  return { success: true, data: { id: result.data.id } };
}


const REACTIVATION_BRANCH_ERROR =
  "An active branch is required to reactivate this student";

interface ReactivationOutcome {
  id: string | null;
  error: string | null;
}

export async function reactivateStudent(
  input: StudentReactivateInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = studentReactivateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(async (tx) => {
    const student = await tx.students.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, branch_id: true, is_active: true },
    });

    if (student === null) {
      return { id: null, error: "Student not found" } satisfies ReactivationOutcome;
    }
    if (student.is_active) {
      return { id: student.id, error: null } satisfies ReactivationOutcome;
    }

    const branchId = parsed.data.branch_id ?? student.branch_id;
    const branch = await tx.branches.findUnique({
      where: { id: branchId },
      select: { id: true, is_active: true },
    });

    if (branch === null || !branch.is_active) {
      return {
        id: null,
        error: REACTIVATION_BRANCH_ERROR,
      } satisfies ReactivationOutcome;
    }

    const reactivatedStudent = await tx.students.update({
      where: { id: student.id },
      data: {
        is_active: true,
        ...(branchId === student.branch_id ? {} : { branch_id: branchId }),
      },
      select: { id: true },
    });

    return { id: reactivatedStudent.id, error: null } satisfies ReactivationOutcome;
  });

  if (!result.success) return result;
  if (result.data.id === null) {
    return { success: false, error: result.data.error ?? "Operation failed" };
  }

  return { success: true, data: { id: result.data.id } };
}
