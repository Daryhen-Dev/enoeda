import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONDUCT_MESSAGES,
  PUBLIC_STUDENT_REGISTRATION_MESSAGES,
  STUDENT_ENROLLMENT_MESSAGES,
  formatCurrency,
} from "@/lib/localization/es-ec";
import type { ConductRecord } from "@/lib/domain/conduct";

const mocks = vi.hoisted(() => ({
  getStudentIdentity: vi.fn(),
  redirect: vi.fn(),
  getOwnConductRecords: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/components/student-enrollment/student-phone-form", () => ({
  StudentPhoneForm: ({ isActive }: { isActive: boolean }) => (
    <div data-phone-form-active={String(isActive)} />
  ),
}));
vi.mock("@/lib/auth/student-identity-resolver", () => ({
  STUDENT_ACTIVATION_STATUS: {
    ACTIVE: "active",
    PENDING: "pending",
  },
  STUDENT_IDENTITY_REASONS: {
    NO_STUDENT: "no_student",
    UNAUTHENTICATED: "unauthenticated",
  },
  getStudentIdentity: mocks.getStudentIdentity,
}));

vi.mock("@/lib/domain/conduct", () => ({
  CONDUCT_KINDS: { FINE: "fine", WARNING: "warning" },
  CONDUCT_STATUSES: { PENDING: "pending", PAID: "paid", ISSUED: "issued" },
  getOwnConductRecords: mocks.getOwnConductRecords,
}));

import StudentProfilePage from "./page";

const baseStudent = {
  activationStatus: "active",
  authUserId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  dateOfBirth: "2000-01-01",
  email: "student@example.com",
  firstName: "Ada",
  id: "b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  isActive: true,
  nationalId: "0102030405",
  phone: "0999999999",
  surname: "Lovelace",
};

const PENDING_FINE: ConductRecord = {
  id: "cccccccc-1111-2222-8333-444444444444",
  student_id: "b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  kind: "fine",
  reason: "Retrasó el equipo",
  incident_date: new Date("2026-01-05T00:00:00.000Z"),
  amount: 5,
  status: "pending",
  paid_at: null,
  paid_by: null,
  voided_at: null,
  voided_by: null,
  void_reason: null,
  created_by: "eeeeeeee-1111-2222-8333-444444444444",
  created_at: new Date("2026-01-05T10:00:00.000Z"),
  updated_at: new Date("2026-01-05T10:00:00.000Z"),
};

describe("StudentProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the conduct section with summary and records", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: true,
      student: { ...baseStudent },
    });
    mocks.getOwnConductRecords.mockResolvedValue({
      success: true,
      data: {
        records: [PENDING_FINE],
        summary: {
          pending_fines_count: 1,
          pending_fines_total: 5,
          warnings_count: 0,
        },
      },
    });

    const markup = renderToStaticMarkup(await StudentProfilePage());

    expect(markup).toContain(CONDUCT_MESSAGES.PANEL_TITLE);
    expect(markup).toContain("Retrasó el equipo");
    expect(markup).toContain(CONDUCT_MESSAGES.STATUS_PENDING);
    expect(markup).toContain(formatCurrency(5));
    expect(markup).toContain(
      CONDUCT_MESSAGES.SUMMARY_PENDING_FINES(1, formatCurrency(5))
    );
  });

  it("shows the conduct empty state when there are no records or the query fails", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: true,
      student: { ...baseStudent },
    });

    mocks.getOwnConductRecords.mockResolvedValue({
      success: false,
      error: "unexpected",
    });
    let markup = renderToStaticMarkup(await StudentProfilePage());
    expect(markup).toContain(CONDUCT_MESSAGES.EMPTY_STATE);

    mocks.getOwnConductRecords.mockResolvedValue({
      success: true,
      data: {
        records: [],
        summary: {
          pending_fines_count: 0,
          pending_fines_total: 0,
          warnings_count: 0,
        },
      },
    });
    markup = renderToStaticMarkup(await StudentProfilePage());
    expect(markup).toContain(CONDUCT_MESSAGES.EMPTY_STATE);
    expect(markup).not.toContain(PENDING_FINE.reason);
  });

  it("shows pending activation while preserving phone editing for an active student", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: true,
      student: { ...baseStudent, activationStatus: "pending" },
    });

    const markup = renderToStaticMarkup(await StudentProfilePage());

    expect(markup).toContain(PUBLIC_STUDENT_REGISTRATION_MESSAGES.PENDING_TITLE);
    expect(markup).toContain(
      PUBLIC_STUDENT_REGISTRATION_MESSAGES.PENDING_DESCRIPTION
    );
    expect(markup).toContain('data-phone-form-active="true"');
  });

  it("keeps a suspended student read-only independently of activation status", async () => {
    mocks.getStudentIdentity.mockResolvedValue({
      ok: true,
      student: { ...baseStudent, isActive: false },
    });

    const markup = renderToStaticMarkup(await StudentProfilePage());

    expect(markup).toContain(STUDENT_ENROLLMENT_MESSAGES.INACTIVE_READ_ONLY);
    expect(markup).toContain('data-phone-form-active="false"');
    expect(markup).not.toContain(
      PUBLIC_STUDENT_REGISTRATION_MESSAGES.PENDING_TITLE
    );
  });
});
