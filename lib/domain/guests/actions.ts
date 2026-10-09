"use server";

import {
  withAuthenticatedUser,
  type AuthenticatedContext,
} from "@/lib/auth/server-context";
import {
  assertCallerBranchContext,
  BRANCH_ASSERTION_MESSAGES,
} from "@/lib/auth/branch-assertion";
import { parseDateOnly } from "@/lib/date";
import {
  ATTENDANCE_MESSAGES,
  COMMON_MESSAGES,
  GUEST_MESSAGES,
} from "@/lib/localization/es-ec";
import {
  authorizeAttendanceSession,
  ATTENDANCE_SESSION_AUTHORIZATION,
} from "@/lib/domain/attendance/session-authorization";
import { CAPTURE_WINDOW_DAYS } from "@/lib/domain/attendance/schema";
import {
  addGuestToSessionSchema,
  getGuestForConversionSchema,
  linkGuestToStudentSchema,
  listSessionGuestsSchema,
  removeGuestFromSessionSchema,
  type AddGuestToSessionInput,
  type GetGuestForConversionInput,
  type LinkGuestToStudentInput,
  type ListSessionGuestsInput,
  type RemoveGuestFromSessionInput,
} from "./schema";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * A trial-class guest of one class occurrence (T7). Guests are not students:
 * no national id, email or birth date; they may later be converted into a
 * student via `converted_student_id`.
 */
export interface SessionGuestRow {
  guest_id: string;
  first_name: string;
  surname: string;
  phone: string | null;
  observation: string | null;
  converted_student_id: string | null;
  created_by: string | null;
}

export interface GuestConversionData {
  first_name: string;
  surname: string;
  phone: string | null;
  discipline_id: string;
  discipline_name: string;
  /** Branch display name, for the locked branch field of the student form. */
  branch_name: string;
}

/** The caller's roles within a branch, resolved once per action. */
function branchRoles(ctx: AuthenticatedContext, branchId: string) {
  return {
    isOwner: ctx.roles.includes("owner"),
    isActiveBranchAdmin: ctx.assignments.some(
      (assignment) =>
        assignment.role === "admin" && assignment.branchId === branchId
    ),
    isBranchTeacher: ctx.assignments.some(
      (assignment) =>
        assignment.role === "teacher" && assignment.branchId === branchId
    ),
  };
}

/** Attendance-like where clause for the guest's occurrence (both kinds). */
function occurrenceGuestWhere(input: {
  scheduled_class_id?: string;
  one_time_class_id?: string;
  session_date?: string;
}) {
  return input.scheduled_class_id
    ? {
        scheduled_class_id: input.scheduled_class_id,
        session_date: parseDateOnly(input.session_date!),
      }
    : { one_time_class_id: input.one_time_class_id! };
}

const GUEST_MESSAGES_SET = new Set<string>([
  ...Object.values(GUEST_MESSAGES),
  ...Object.values(ATTENDANCE_MESSAGES),
  ...Object.values(BRANCH_ASSERTION_MESSAGES),
  COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS,
]);

/**
 * Keep known, expected guard failures as user-facing copy; everything else
 * falls back to the generic unexpected-error message.
 */
function mapGuestActionError(error: unknown): string | undefined {
  if (error instanceof Error && GUEST_MESSAGES_SET.has(error.message)) {
    return error.message;
  }
  return undefined;
}

/**
 * addGuestToSession — Adds a trial-class guest to a session. Uses the same
 * session authorization and guards as addPerClassStudentToSession:
 * branch context, session authorization (teacher of the session or branch
 * admin), suspension (recurring only), future date and capture window.
 * The one-time class date is used as session_date; no duplicate check
 * exists (guests have no unique identity yet).
 */
export async function addGuestToSession(
  input: AddGuestToSessionInput
): Promise<ActionResult<{ guest_id: string }>> {
  const parsed = addGuestToSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(
    async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        throw new Error(branchError);
      }

      const attendanceSession = await authorizeAttendanceSession(
        tx,
        ctx,
        parsed.data,
        parsed.data.branch_id
      );
      if (attendanceSession.status === ATTENDANCE_SESSION_AUTHORIZATION.INVALID) {
        throw new Error(GUEST_MESSAGES.INVALID_SESSION);
      }
      if (attendanceSession.status === ATTENDANCE_SESSION_AUTHORIZATION.DENIED) {
        throw new Error(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
      }

      const sessionDate = parsed.data.scheduled_class_id
        ? parseDateOnly(parsed.data.session_date!)
        : attendanceSession.sessionDate;

      if (parsed.data.scheduled_class_id) {
        // Suspension check (only recurring classes can be suspended)
        const sessionOverride = await tx.class_sessions.findUnique({
          where: {
            scheduled_class_id_session_date: {
              scheduled_class_id: parsed.data.scheduled_class_id,
              session_date: sessionDate,
            },
          },
          select: { status: true },
        });
        if (sessionOverride?.status === "suspended") {
          throw new Error(ATTENDANCE_MESSAGES.SESSION_SUSPENDED);
        }
      }

      // Future date guard
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (sessionDate > today) {
        throw new Error(ATTENDANCE_MESSAGES.FUTURE_SESSION);
      }

      // Capture window guard (this creates a NEW guest)
      const diffDays = Math.floor(
        (today.getTime() - sessionDate.getTime()) / 86400000
      );
      if (diffDays > CAPTURE_WINDOW_DAYS) {
        throw new Error(ATTENDANCE_MESSAGES.CAPTURE_WINDOW_EXCEEDED);
      }

      const guest = await tx.class_guests.create({
        data: {
          branch_id: parsed.data.branch_id,
          scheduled_class_id: parsed.data.scheduled_class_id ?? null,
          one_time_class_id: parsed.data.one_time_class_id ?? null,
          session_date: sessionDate,
          first_name: parsed.data.first_name,
          surname: parsed.data.surname,
          phone: parsed.data.phone || null,
          observation: parsed.data.observation || null,
          created_by: ctx.userId,
        },
        select: { id: true },
      });

      return { guest_id: guest.id };
    },
    { mapTransactionError: mapGuestActionError }
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
}

/**
 * listSessionGuests — Returns the trial-class guests of the occurrence with
 * their conversion state. Same session authorization as attendance
 * (teacher of the session or branch admin); read-only, so no suspension,
 * future or capture window guards apply.
 */
export async function listSessionGuests(
  input: ListSessionGuestsInput
): Promise<ActionResult<SessionGuestRow[]>> {
  const parsed = listSessionGuestsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(
    async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        throw new Error(branchError);
      }

      const attendanceSession = await authorizeAttendanceSession(
        tx,
        ctx,
        parsed.data,
        parsed.data.branch_id
      );
      if (attendanceSession.status === ATTENDANCE_SESSION_AUTHORIZATION.INVALID) {
        throw new Error(GUEST_MESSAGES.INVALID_SESSION);
      }
      if (attendanceSession.status === ATTENDANCE_SESSION_AUTHORIZATION.DENIED) {
        throw new Error(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
      }

      const guests = await tx.class_guests.findMany({
        where: occurrenceGuestWhere(parsed.data),
        select: {
          id: true,
          first_name: true,
          surname: true,
          phone: true,
          observation: true,
          converted_student_id: true,
          created_by: true,
        },
        orderBy: [{ surname: "asc" }, { first_name: "asc" }],
      });

      return guests.map<SessionGuestRow>((guest) => ({
        guest_id: guest.id,
        first_name: guest.first_name,
        surname: guest.surname,
        phone: guest.phone,
        observation: guest.observation,
        converted_student_id: guest.converted_student_id,
        created_by: guest.created_by,
      }));
    },
    { mapTransactionError: mapGuestActionError }
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
}

/**
 * removeGuestFromSession — Removes a guest from its occurrence. Branch
 * admins and the owner may remove any guest; a teacher may only remove a
 * guest they created themselves, within the capture window.
 */
export async function removeGuestFromSession(
  input: RemoveGuestFromSessionInput
): Promise<ActionResult<{ removed: boolean }>> {
  const parsed = removeGuestFromSessionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(
    async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        throw new Error(branchError);
      }

      const guest = await tx.class_guests.findUnique({
        where: { id: parsed.data.guest_id },
        select: {
          id: true,
          branch_id: true,
          created_by: true,
          session_date: true,
        },
      });

      // Same error whether the guest does not exist or belongs to another
      // branch: no cross-branch information leak.
      if (!guest || guest.branch_id !== parsed.data.branch_id) {
        throw new Error(GUEST_MESSAGES.NOT_FOUND);
      }

      const { isOwner, isActiveBranchAdmin } = branchRoles(
        ctx,
        parsed.data.branch_id
      );

      if (!isOwner && !isActiveBranchAdmin) {
        if (guest.created_by !== ctx.userId) {
          throw new Error(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
        }
        // Same capture window as attendance creation, measured from the
        // session date (the class date for one-time classes).
        const sessionDate = new Date(guest.session_date);
        const diffDays = Math.floor(
          (Date.now() - sessionDate.getTime()) / 86400000
        );
        if (diffDays > CAPTURE_WINDOW_DAYS) {
          throw new Error(GUEST_MESSAGES.REMOVE_WINDOW_EXCEEDED);
        }
      }

      await tx.class_guests.delete({ where: { id: guest.id } });
      return { removed: true };
    },
    { mapTransactionError: mapGuestActionError }
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
}

/**
 * getGuestForConversion — Returns the guest's prefill data (name, surname,
 * phone) and the class discipline so the UI can open the student creation
 * form prefilled. Branch admins, the owner and teachers of the branch are
 * allowed (not limited to the session's teacher, so any branch teacher can
 * help converting a guest).
 */
export async function getGuestForConversion(
  input: GetGuestForConversionInput
): Promise<ActionResult<GuestConversionData>> {
  const parsed = getGuestForConversionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(
    async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        throw new Error(branchError);
      }

      const { isOwner, isActiveBranchAdmin, isBranchTeacher } = branchRoles(
        ctx,
        parsed.data.branch_id
      );
      if (!isOwner && !isActiveBranchAdmin && !isBranchTeacher) {
        throw new Error(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
      }

      const guest = await tx.class_guests.findUnique({
        where: { id: parsed.data.guest_id },
        select: {
          branch_id: true,
          first_name: true,
          surname: true,
          phone: true,
          scheduled_class_id: true,
          one_time_class_id: true,
        },
      });
      if (!guest || guest.branch_id !== parsed.data.branch_id) {
        throw new Error(GUEST_MESSAGES.NOT_FOUND);
      }

      const classRow = guest.scheduled_class_id
        ? await tx.scheduled_classes.findUnique({
            where: { id: guest.scheduled_class_id },
            select: {
              discipline_id: true,
              disciplines: { select: { name: true } },
            },
          })
        : await tx.one_time_classes.findUnique({
            where: { id: guest.one_time_class_id! },
            select: {
              discipline_id: true,
              disciplines: { select: { name: true } },
            },
          });

      if (!classRow) {
        throw new Error(GUEST_MESSAGES.NOT_FOUND);
      }

      const branch = await tx.branches.findUnique({
        where: { id: guest.branch_id },
        select: { name: true },
      });

      return {
        first_name: guest.first_name,
        surname: guest.surname,
        phone: guest.phone,
        discipline_id: classRow.discipline_id,
        discipline_name: classRow.disciplines.name,
        branch_name: branch?.name ?? "",
      };
    },
    { mapTransactionError: mapGuestActionError }
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
}

/**
 * linkGuestToStudent — Links a guest to the student created from it.
 * The student must belong to the same branch. Idempotent when the guest is
 * already linked to the same student; rejects linking to a different one.
 * Branch admins, the owner and teachers of the branch are allowed.
 */
export async function linkGuestToStudent(
  input: LinkGuestToStudentInput
): Promise<ActionResult<{ guest_id: string; student_id: string }>> {
  const parsed = linkGuestToStudentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(
    async (tx, ctx) => {
      const branchError = assertCallerBranchContext(ctx, parsed.data.branch_id);
      if (branchError) {
        throw new Error(branchError);
      }

      const { isOwner, isActiveBranchAdmin, isBranchTeacher } = branchRoles(
        ctx,
        parsed.data.branch_id
      );
      if (!isOwner && !isActiveBranchAdmin && !isBranchTeacher) {
        throw new Error(COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS);
      }

      const guest = await tx.class_guests.findUnique({
        where: { id: parsed.data.guest_id },
        select: { id: true, branch_id: true, converted_student_id: true },
      });
      if (!guest || guest.branch_id !== parsed.data.branch_id) {
        throw new Error(GUEST_MESSAGES.NOT_FOUND);
      }

      // Idempotent: already linked to the same student.
      if (guest.converted_student_id === parsed.data.student_id) {
        return { guest_id: guest.id, student_id: parsed.data.student_id };
      }

      if (guest.converted_student_id !== null) {
        throw new Error(GUEST_MESSAGES.ALREADY_LINKED);
      }

      const student = await tx.students.findUnique({
        where: { id: parsed.data.student_id },
        select: { branch_id: true },
      });
      if (!student || student.branch_id !== parsed.data.branch_id) {
        throw new Error(GUEST_MESSAGES.STUDENT_BRANCH_MISMATCH);
      }

      await tx.class_guests.update({
        where: { id: guest.id },
        data: { converted_student_id: parsed.data.student_id },
      });

      return { guest_id: guest.id, student_id: parsed.data.student_id };
    },
    { mapTransactionError: mapGuestActionError }
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
}
