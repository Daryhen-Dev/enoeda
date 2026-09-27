import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  claimPublicRegistrationChallenge: vi.fn(),
  consumePublicRegistrationRateLimit: vi.fn(),
  getPayloadFromRequest: vi.fn(),
  getPublicRegistrationAltcha: vi.fn(),
  registerPublicStudent: vi.fn(),
  verifyPublicRegistrationAltcha: vi.fn(),
}));

vi.mock("@/lib/domain/student-registration", async () => {
  const { publicStudentRegistrationSchema } = await import(
    "@/lib/domain/student-registration/schema"
  );

  return {
    claimPublicRegistrationChallenge: mocks.claimPublicRegistrationChallenge,
    consumePublicRegistrationRateLimit: mocks.consumePublicRegistrationRateLimit,
    getPublicRegistrationAltcha: mocks.getPublicRegistrationAltcha,
    publicStudentRegistrationSchema,
    registerPublicStudent: mocks.registerPublicStudent,
    verifyPublicRegistrationAltcha: mocks.verifyPublicRegistrationAltcha,
  };
});

import { POST } from "./route";

const validFields = {
  altcha: "signed-payload",
  branch_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  date_of_birth: "2010-06-15",
  email: "Student@Example.com",
  first_name: "Ana",
  national_id: "1234567890",
  password: "secure-password",
  phone: "0999999999",
  surname: "Pérez",
};

function request(fields: Record<string, string>) {
  return new NextRequest("https://enoeda.test/api/public/student-registration", {
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
}

describe("public student registration route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPayloadFromRequest.mockResolvedValue("signed-payload");
    mocks.getPublicRegistrationAltcha.mockReturnValue({
      getPayloadFromRequest: mocks.getPayloadFromRequest,
    });
    mocks.verifyPublicRegistrationAltcha.mockResolvedValue({
      expiresAt: "2026-09-04T12:05:00.000Z",
      nonceHash: "a".repeat(64),
    });
    mocks.claimPublicRegistrationChallenge.mockResolvedValue({ kind: "allowed" });
    mocks.consumePublicRegistrationRateLimit.mockResolvedValue({ kind: "allowed" });
    mocks.registerPublicStudent.mockResolvedValue({
      studentId: "d1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      success: true,
    });
  });

  it("rejects malformed registration data before CAPTCHA, rate-limit, or Auth services", async () => {
    const response = await POST(request({ ...validFields, email: "invalid" }));

    expect(response.status).toBe(400);
    expect(mocks.getPublicRegistrationAltcha).toHaveBeenCalledTimes(1);
    expect(mocks.verifyPublicRegistrationAltcha).not.toHaveBeenCalled();
    expect(mocks.claimPublicRegistrationChallenge).not.toHaveBeenCalled();
    expect(mocks.consumePublicRegistrationRateLimit).not.toHaveBeenCalled();
    expect(mocks.registerPublicStudent).not.toHaveBeenCalled();
  });

  it("blocks an invalid CAPTCHA before rate limiting or account creation", async () => {
    mocks.verifyPublicRegistrationAltcha.mockResolvedValue(null);

    const response = await POST(request(validFields));

    expect(response.status).toBe(403);
    expect(mocks.claimPublicRegistrationChallenge).not.toHaveBeenCalled();
    expect(mocks.consumePublicRegistrationRateLimit).not.toHaveBeenCalled();
    expect(mocks.registerPublicStudent).not.toHaveBeenCalled();
  });

  it("rejects a replayed challenge before rate limiting or account creation", async () => {
    mocks.claimPublicRegistrationChallenge.mockResolvedValue({ kind: "rejected" });

    const response = await POST(request(validFields));

    expect(response.status).toBe(403);
    expect(mocks.consumePublicRegistrationRateLimit).not.toHaveBeenCalled();
    expect(mocks.registerPublicStudent).not.toHaveBeenCalled();
  });

  it("rejects a limited identity before account creation", async () => {
    mocks.consumePublicRegistrationRateLimit.mockResolvedValue({ kind: "rejected" });

    const response = await POST(request(validFields));

    expect(response.status).toBe(429);
    expect(mocks.registerPublicStudent).not.toHaveBeenCalled();
  });

  it("normalizes the email and creates the pending student only after all safeguards pass", async () => {
    const response = await POST(request(validFields));

    expect(response.status).toBe(201);
    expect(mocks.consumePublicRegistrationRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      "student@example.com"
    );
    expect(mocks.registerPublicStudent).toHaveBeenCalledWith(
      expect.objectContaining({ email: "student@example.com" })
    );
  });
});
