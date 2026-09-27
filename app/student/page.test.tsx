import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUBLIC_STUDENT_REGISTRATION_MESSAGES,
  STUDENT_ENROLLMENT_MESSAGES,
} from "@/lib/localization/es-ec";

const mocks = vi.hoisted(() => ({
  getStudentIdentity: vi.fn(),
  redirect: vi.fn(),
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

describe("StudentProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
