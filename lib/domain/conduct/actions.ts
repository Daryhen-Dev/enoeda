"use server";

import { withAuthenticatedUser } from "@/lib/auth/server-context";
import {
  assertCallerBranchContext,
  BRANCH_ASSERTION_MESSAGES,
} from "@/lib/auth/branch-assertion";
import { getStudentIdentity, STUDENT_IDENTITY_REASONS } from "@/lib/auth/student-identity-resolver";
import { createClient } from "@/lib/supabase/server";
import {
  COMMON_MESSAGES,
  CONDUCT_MESSAGES,
  STUDENT_ENROLLMENT_MESSAGES,
} from "@/lib/localization/es-ec";
import {
  createConductRecordSchema,
  conductRecordActionSchema,
  voidConductRecordSchema,
  conductQuerySchema,
  searchConductStudentsSchema,
  listRecentBranchConductRecordsSchema,
  CONDUCT_KINDS,
  CONDUCT_STATUSES,
  type CreateConductRecordInput,
  type ConductRecordActionInput,
  type VoidConductRecordInput,
  type ConductQueryInput,
  type SearchConductStudentsInput,
  type ListRecentBranchConductRecordsInput,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ConductRecord {
  id: string;
  student_id: string;
  kind: string;
  reason: string;
  incident_date: Date;
  amount: number | null;
  status: string;
  paid_at: Date | null;
  paid_by: string | null;
  voided_at: Date | null;
  voided_by: string | null;
  void_reason: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ConductSummary {
  /** Pending, non-voided fines. */
  pending_fines_count: number;
  /** Sum of pending, non-voided fine amounts. */
  pending_fines_total: number;
  /** Non-voided warnings. */
  warnings_count: number;
}

export interface ConductRecordsPage {
  records: ConductRecord[];
  summary: ConductSummary;
}

/** Quick-entry search result row: student identity + conduct counters. */
export interface ConductStudentSearchRow {
  id: string;
  first_name: string;
  surname: string;
  national_id: string;
  pending_fines_count: number;
  pending_fines_total: number;
  warnings_count: number;
}

/** Branch-level recent record with a minimal student for display. */
export interface RecentConductRecord {
  id: string;
  student_id: string;
  student: {
    id: string;
    first_name: string;
    surname: string;
  };
  kind: string;
  reason: string;
  incident_date: Date;
  amount: number | null;
  status: string;
  paid_at: Date | null;
  paid_by: string | null;
  voided_at: Date | null;
  voided_by: string | null;
  void_reason: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Exception texts raised by the private.prevent_conduct_record_invalid_update()
 * trigger. They indicate a concurrent state change; map them to friendly copy.
 */
const CONDUCT_TRIGGER_EXCEPTIONS = [
  "conduct record identity fields are immutable",
  "voided conduct records cannot be modified or un-voided",
  "paid fines cannot be reverted to pending",
  "voided conduct records cannot be paid",
] as const;

function mapConductTransactionError(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    (CONDUCT_TRIGGER_EXCEPTIONS as readonly string[]).includes(error.message)
  ) {
    return CONDUCT_MESSAGES.RECORD_CONFLICT;
  }
  return undefined;
}

function todayDateString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function buildSummary(records: ConductRecord[]): ConductSummary {
  let pendingFinesCount = 0;
  let pendingFinesTotal = 0;
  let warningsCount = 0;
  for (const record of records) {
    if (record.voided_at !== null) continue;
    if (
      record.kind === CONDUCT_KINDS.FINE &&
      record.status === CONDUCT_STATUSES.PENDING
    ) {
      pendingFinesCount += 1;
      pendingFinesTotal += record.amount ?? 0;
    }
    if (record.kind === CONDUCT_KINDS.WARNING) {
      warningsCount += 1;
    }
  }
  return {
    pending_fines_count: pendingFinesCount,
    pending_fines_total: pendingFinesTotal,
    warnings_count: warningsCount,
  };
}

/**
 * Register a fine or a warning for a student. Admin/Teacher branch-scoped
 * via RLS. Fines are created pending; warnings are created issued.
 * Requires branch context; validates student belongs to caller's branch.
 */
export async function createConductRecord(
  input: CreateConductRecordInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createConductRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { student_id, branch_id, kind, reason } = parsed.data;
  const amount = parsed.data.kind === CONDUCT_KINDS.FINE ? parsed.data.amount : null;
  const incidentDate =
    parsed.data.incident_date ?? todayDateString();

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) {
        return { id: null, error: branchError } as const;
      }

      const student = await tx.students.findUnique({
        where: { id: student_id },
        select: { branch_id: true },
      });
      if (!student || student.branch_id !== branch_id) {
        return {
          id: null,
          error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED,
        } as const;
      }

      const record = await tx.student_conduct_records.create({
        data: {
          student_id,
          kind,
          reason,
          incident_date: new Date(incidentDate + "T00:00:00"),
          amount,
          status:
            kind === CONDUCT_KINDS.FINE
              ? CONDUCT_STATUSES.PENDING
              : CONDUCT_STATUSES.ISSUED,
          created_by: ctx.userId,
        },
        select: { id: true },
      });

      return { id: record.id, error: null } as const;
    }, { mapTransactionError: mapConductTransactionError });

    if (!result.success) return result;
    if (result.data.id === null) {
      return {
        success: false,
        error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
      };
    }
    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Mark a pending fine as paid. Only non-voided pending fines qualify.
 * Requires branch context; validates the record's student belongs to the
 * caller's branch.
 */
export async function markFinePaid(
  input: ConductRecordActionInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = conductRecordActionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { id, branch_id } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) {
        return { id: null, error: branchError } as const;
      }

      const record = await tx.student_conduct_records.findUnique({
        where: { id },
        select: {
          id: true,
          kind: true,
          status: true,
          voided_at: true,
          students: { select: { branch_id: true } },
        },
      });
      if (!record) {
        return { id: null, error: CONDUCT_MESSAGES.INVALID_ID } as const;
      }
      if (record.students.branch_id !== branch_id) {
        return {
          id: null,
          error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED,
        } as const;
      }
      if (record.kind !== CONDUCT_KINDS.FINE) {
        return { id: null, error: CONDUCT_MESSAGES.NOT_A_FINE } as const;
      }
      if (record.voided_at !== null) {
        return { id: null, error: CONDUCT_MESSAGES.ALREADY_VOIDED } as const;
      }
      if (record.status === CONDUCT_STATUSES.PAID) {
        return { id: null, error: CONDUCT_MESSAGES.ALREADY_PAID } as const;
      }

      await tx.student_conduct_records.update({
        where: { id: record.id },
        data: {
          status: CONDUCT_STATUSES.PAID,
          paid_at: new Date(),
          paid_by: ctx.userId,
        },
      });

      return { id: record.id, error: null } as const;
    }, { mapTransactionError: mapConductTransactionError });

    if (!result.success) return result;
    if (result.data.id === null) {
      return {
        success: false,
        error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
      };
    }
    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Void a conduct record with reason, actor and timestamp. Voiding is
 * terminal; paid fines cannot be voided (the update guard trigger enforces
 * the same rule). Requires branch context; validates the record's student
 * belongs to the caller's branch.
 */
export async function voidConductRecord(
  input: VoidConductRecordInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = voidConductRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { id, branch_id, void_reason } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) {
        return { id: null, error: branchError } as const;
      }

      const record = await tx.student_conduct_records.findUnique({
        where: { id },
        select: {
          id: true,
          kind: true,
          status: true,
          voided_at: true,
          students: { select: { branch_id: true } },
        },
      });
      if (!record) {
        return { id: null, error: CONDUCT_MESSAGES.INVALID_ID } as const;
      }
      if (record.students.branch_id !== branch_id) {
        return {
          id: null,
          error: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED,
        } as const;
      }
      if (record.voided_at !== null) {
        return { id: null, error: CONDUCT_MESSAGES.ALREADY_VOIDED } as const;
      }
      if (
        record.kind === CONDUCT_KINDS.FINE &&
        record.status === CONDUCT_STATUSES.PAID
      ) {
        return { id: null, error: CONDUCT_MESSAGES.PAID_NOT_VOIDABLE } as const;
      }

      await tx.student_conduct_records.update({
        where: { id: record.id },
        data: {
          voided_at: new Date(),
          voided_by: ctx.userId,
          void_reason,
        },
      });

      return { id: record.id, error: null } as const;
    }, { mapTransactionError: mapConductTransactionError });

    if (!result.success) return result;
    if (result.data.id === null) {
      return {
        success: false,
        error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
      };
    }
    return { success: true, data: { id: result.data.id } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * List all conduct records of a student for staff (owner/admin/teacher),
 * newest first, including voided records flagged as such. Returns creator,
 * payer and voider ids (display names are not resolved, consistent with the
 * notes module). Includes the pending-fines and warnings summary.
 * Requires branch context; validates student belongs to caller's branch.
 */
export async function listStudentConductRecords(
  input: ConductQueryInput
): Promise<ActionResult<ConductRecordsPage>> {
  const parsed = conductQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { student_id, branch_id } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) {
        return { __branchError: branchError } as const;
      }

      const student = await tx.students.findUnique({
        where: { id: student_id },
        select: { branch_id: true },
      });
      if (!student || student.branch_id !== branch_id) {
        return {
          __branchError: BRANCH_ASSERTION_MESSAGES.CROSS_BRANCH_DENIED,
        } as const;
      }

      return tx.student_conduct_records.findMany({
        where: { student_id },
        select: {
          id: true,
          student_id: true,
          kind: true,
          reason: true,
          incident_date: true,
          amount: true,
          status: true,
          paid_at: true,
          paid_by: true,
          voided_at: true,
          voided_by: true,
          void_reason: true,
          created_by: true,
          created_at: true,
          updated_at: true,
        },
        orderBy: { created_at: "desc" },
      });
    });

    if (!result.success) return result;

    if ("__branchError" in result.data) {
      return {
        success: false,
        error: (result.data as { __branchError: string }).__branchError,
      };
    }

    const rows = result.data as Exclude<
      typeof result.data,
      { __branchError: string }
    >;
    const records: ConductRecord[] = rows.map((row) => ({
      id: row.id,
      student_id: row.student_id,
      kind: row.kind,
      reason: row.reason,
      incident_date: row.incident_date,
      amount: row.amount === null ? null : Number(row.amount),
      status: row.status,
      paid_at: row.paid_at,
      paid_by: row.paid_by,
      voided_at: row.voided_at,
      voided_by: row.voided_by,
      void_reason: row.void_reason,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return { success: true, data: { records, summary: buildSummary(records) } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Quick-entry student search: ACTIVE students of the branch matching every
 * whitespace-separated term against first_name, surname or national_id
 * (case-insensitive contains; this also matches "first surname" full-name
 * order). Returns at most 8 students ordered by surname, first_name, id,
 * with pending-fine and warning counters aggregated in ONE grouped query
 * (voided records excluded from the counts).
 * Requires branch context (admin/teacher).
 */
export async function searchConductStudents(
  input: SearchConductStudentsInput
): Promise<ActionResult<{ students: ConductStudentSearchRow[] }>> {
  const parsed = searchConductStudentsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, query } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) {
        return { __branchError: branchError } as const;
      }

      const terms = query.split(/\s+/u).filter((term) => term.length > 0);
      const students = await tx.students.findMany({
        where: {
          branch_id,
          is_active: true,
          AND: terms.map((term) => ({
            OR: [
              { first_name: { contains: term, mode: "insensitive" } },
              { surname: { contains: term, mode: "insensitive" } },
              { national_id: { contains: term, mode: "insensitive" } },
            ],
          })),
        },
        select: {
          id: true,
          first_name: true,
          surname: true,
          national_id: true,
        },
        orderBy: [{ surname: "asc" }, { first_name: "asc" }, { id: "asc" }],
        take: 8,
      });

      if (students.length === 0) {
        return { students: [] };
      }

      const studentIds = students.map((student) => student.id);
      const groups = await tx.student_conduct_records.groupBy({
        by: ["student_id", "kind", "status"],
        where: {
          student_id: { in: studentIds },
          voided_at: null,
          OR: [
            { kind: CONDUCT_KINDS.WARNING },
            {
              kind: CONDUCT_KINDS.FINE,
              status: CONDUCT_STATUSES.PENDING,
            },
          ],
        },
        _count: { _all: true },
        _sum: { amount: true },
      });

      const summaryByStudent = new Map<
        string,
        Omit<ConductStudentSearchRow, "id" | "first_name" | "surname" | "national_id">
      >();
      for (const group of groups) {
        const entry = summaryByStudent.get(group.student_id) ?? {
          pending_fines_count: 0,
          pending_fines_total: 0,
          warnings_count: 0,
        };
        if (group.kind === CONDUCT_KINDS.WARNING) {
          entry.warnings_count += group._count._all;
        } else {
          entry.pending_fines_count += group._count._all;
          entry.pending_fines_total +=
            group._sum.amount === null ? 0 : Number(group._sum.amount);
        }
        summaryByStudent.set(group.student_id, entry);
      }

      return {
        students: students.map((student) => ({
          id: student.id,
          first_name: student.first_name,
          surname: student.surname,
          national_id: student.national_id,
          ...(summaryByStudent.get(student.id) ?? {
            pending_fines_count: 0,
            pending_fines_total: 0,
            warnings_count: 0,
          }),
        })),
      };
    });

    if (!result.success) return result;

    if ("__branchError" in result.data) {
      return {
        success: false,
        error: (result.data as { __branchError: string }).__branchError,
      };
    }

    return {
      success: true,
      data: result.data as Exclude<
        typeof result.data,
        { __branchError: string }
      >,
    };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * Latest conduct records (fines and warnings) of the branch's students,
 * newest first. Voided and flagged records are included; each row carries
 * a minimal student object for display. Amounts are returned as numbers.
 * Requires branch context (admin/teacher).
 */
export async function listRecentBranchConductRecords(
  input: ListRecentBranchConductRecordsInput
): Promise<ActionResult<{ records: RecentConductRecord[] }>> {
  const parsed = listRecentBranchConductRecordsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { branch_id, limit } = parsed.data;

  try {
    const result = await withAuthenticatedUser(async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, branch_id);
      if (branchError) {
        return { __branchError: branchError } as const;
      }

      return tx.student_conduct_records.findMany({
        where: { students: { branch_id } },
        select: {
          id: true,
          student_id: true,
          kind: true,
          reason: true,
          incident_date: true,
          amount: true,
          status: true,
          paid_at: true,
          paid_by: true,
          voided_at: true,
          voided_by: true,
          void_reason: true,
          created_by: true,
          created_at: true,
          updated_at: true,
          students: {
            select: { id: true, first_name: true, surname: true },
          },
        },
        orderBy: { created_at: "desc" },
        take: limit,
      });
    });

    if (!result.success) return result;

    if ("__branchError" in result.data) {
      return {
        success: false,
        error: (result.data as { __branchError: string }).__branchError,
      };
    }

    const rows = result.data as Exclude<
      typeof result.data,
      { __branchError: string }
    >;
    const records: RecentConductRecord[] = rows.map((row) => ({
      id: row.id,
      student_id: row.student_id,
      student: {
        id: row.students.id,
        first_name: row.students.first_name,
        surname: row.students.surname,
      },
      kind: row.kind,
      reason: row.reason,
      incident_date: row.incident_date,
      amount: row.amount === null ? null : Number(row.amount),
      status: row.status,
      paid_at: row.paid_at,
      paid_by: row.paid_by,
      voided_at: row.voided_at,
      voided_by: row.voided_by,
      void_reason: row.void_reason,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return { success: true, data: { records } };
  } catch {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }
}

/**
 * List the signed-in student's own conduct records for the /student portal,
 * read-only and newest first. Voided records are excluded from the student
 * view (they are an internal audit trail); the summary covers only the
 * returned records.
 *
 * Mechanism: the same Supabase SSR client + RLS self-read path the student
 * portal already uses (getStudentIdentity + createClient); the
 * "Student reads own conduct records" RLS policy is load-bearing.
 */
export async function getOwnConductRecords(): Promise<
  ActionResult<ConductRecordsPage>
> {
  const identity = await getStudentIdentity();
  if (!identity.ok) {
    return {
      success: false,
      error:
        identity.reason === STUDENT_IDENTITY_REASONS.UNAUTHENTICATED
          ? COMMON_MESSAGES.AUTHENTICATION_REQUIRED
          : STUDENT_ENROLLMENT_MESSAGES.PROFILE_UNAVAILABLE,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_conduct_records")
    .select(
      "id, student_id, kind, reason, incident_date, amount, status, paid_at, paid_by, voided_at, voided_by, void_reason, created_by, created_at, updated_at"
    )
    .eq("student_id", identity.student.id)
    .is("voided_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  const rows = (data ?? []) as Array<{
    id: string;
    student_id: string;
    kind: string;
    reason: string;
    incident_date: string;
    amount: number | null;
    status: string;
    paid_at: string | null;
    paid_by: string | null;
    voided_at: string | null;
    voided_by: string | null;
    void_reason: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
  }>;

  const records: ConductRecord[] = rows.map((row) => ({
    id: row.id,
    student_id: row.student_id,
    kind: row.kind,
    reason: row.reason,
    incident_date: new Date(row.incident_date + "T00:00:00"),
    amount: row.amount === null ? null : Number(row.amount),
    status: row.status,
    paid_at: row.paid_at === null ? null : new Date(row.paid_at),
    paid_by: row.paid_by,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    created_by: row.created_by,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }));

  return { success: true, data: { records, summary: buildSummary(records) } };
}
