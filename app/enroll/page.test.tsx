import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { STUDENT_ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";

const mocks = vi.hoisted(() => ({
  getStudentEnrollmentContext: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/components/student-enrollment/enrollment-flow", () => ({
  EnrollmentFlow: ({
    email,
    passwordConfigured,
  }: {
    email: string;
    passwordConfigured: boolean;
  }) => (
    <div data-enrollment-flow={email}>
      {String(passwordConfigured)}
    </div>
  ),
}));
vi.mock("@/lib/auth/student-identity-resolver", () => ({
  STUDENT_ENROLLMENT_CONTEXT_KINDS: {
    INVALID: "invalid",
    INVITATION: "invitation",
    STUDENT: "student",
    UNAUTHENTICATED: "unauthenticated",
  },
  getStudentEnrollmentContext: mocks.getStudentEnrollmentContext,
}));
vi.mock("@/lib/domain/student-enrollment", () => ({
  STUDENT_INVITATION_STATES: {
    ACCEPTED: "accepted",
    EXPIRED: "expired",
    NEEDS_REVIEW: "needs_review",
    PENDING: "pending",
    REVOKED: "revoked",
  },
}));

import EnrollmentPage from "./page";

describe("EnrollmentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the enrollment flow only for a pending invitation", async () => {
    mocks.getStudentEnrollmentContext.mockResolvedValue({
      kind: "invitation",
      invitation: {
        email: "student@example.com",
        passwordConfigured: false,
        state: "pending",
      },
    });

    const markup = renderToStaticMarkup(await EnrollmentPage());

    expect(markup).toContain('data-enrollment-flow="student@example.com"');
  });

  it("shows a safe unavailable state rather than a form for an expired invitation", async () => {
    mocks.getStudentEnrollmentContext.mockResolvedValue({
      kind: "invitation",
      invitation: {
        email: "student@example.com",
        passwordConfigured: true,
        state: "expired",
      },
    });

    const markup = renderToStaticMarkup(await EnrollmentPage());

    expect(markup).not.toContain("data-enrollment-flow");
    expect(markup).toContain(STUDENT_ENROLLMENT_MESSAGES.INVITATION_EXPIRED);
  });

  it("redirects unauthenticated visitors to login", async () => {
    mocks.getStudentEnrollmentContext.mockResolvedValue({
      kind: "unauthenticated",
    });
    mocks.redirect.mockImplementation(() => {
      throw new Error("redirected");
    });

    await expect(EnrollmentPage()).rejects.toThrow("redirected");
    expect(mocks.redirect).toHaveBeenCalledWith("/login");
  });
});
