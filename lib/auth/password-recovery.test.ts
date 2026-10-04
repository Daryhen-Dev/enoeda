/**
 * Password recovery request action.
 *
 * The response is enumeration-neutral: a syntactically valid request always
 * reports success, whether or not the email exists in Supabase Auth.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { resetPasswordForEmail: mocks.resetPasswordForEmail },
  }),
}));

const headerValues = new Map<string, string>([
  ["x-forwarded-host", "app.enoeda.test"],
  ["x-forwarded-proto", "https"],
]);

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerValues.get(name) ?? null,
  }),
}));

import { requestPasswordRecovery } from "./password-recovery";

describe("requestPasswordRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("sends a recovery email redirecting to the allowlisted callback", async () => {
    const result = await requestPasswordRecovery({
      email: "Owner@Enoeda.com ",
    });

    expect(result.success).toBe(true);
    expect(mocks.resetPasswordForEmail).toHaveBeenCalledTimes(1);
    const [email, options] = mocks.resetPasswordForEmail.mock.calls[0];
    expect(email).toBe("owner@enoeda.com");
    expect(options.redirectTo).toBe(
      "https://app.enoeda.test/auth/callback?next=%2Freset-password"
    );
  });

  it("stays neutral when Supabase reports an unknown email", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      error: { name: "AuthError", message: "user not found" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await requestPasswordRecovery({
      email: "missing@enoeda.com",
    });

    expect(result.success).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("stays neutral when the request fails entirely", async () => {
    mocks.resetPasswordForEmail.mockRejectedValue(new Error("network"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await requestPasswordRecovery({ email: "a@b.com" });

    expect(result.success).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("rejects invalid input without contacting Supabase", async () => {
    for (const email of ["not-an-email", "", undefined, 42]) {
      const result = await requestPasswordRecovery({ email });
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe("string");
    }
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
