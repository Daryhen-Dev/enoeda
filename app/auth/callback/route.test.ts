import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("@/lib/supabase/config", () => ({
  getSupabasePublicConfig: () => ({
    anonKey: "anon-key",
    url: "https://enoeda.supabase.co",
  }),
}));

import { GET } from "./route";

function request(search = "") {
  return new NextRequest(`https://app.enoeda.test/auth/callback${search}`);
}

describe("Supabase auth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockReturnValue({
      auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
    });
  });

  it("exchanges a valid code and redirects to the fixed student destination", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(request("?code=auth-code"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(response.headers.get("location")).toBe("https://app.enoeda.test/student");
  });

  it("ignores a user-controlled callback target after successful session exchange", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      request("?code=auth-code&next=https%3A%2F%2Fevil.example%2Fsteal")
    );

    expect(response.headers.get("location")).toBe("https://app.enoeda.test/student");
  });

  it("follows only the allowlisted recovery callback target", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      request(`?code=auth-code&next=%2Freset-password`)
    );

    expect(response.headers.get("location")).toBe(
      "https://app.enoeda.test/reset-password"
    );
  });

  it("ignores a next target outside the recovery allowlist", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(request("?code=auth-code&next=%2Fowner"));

    expect(response.headers.get("location")).toBe(
      "https://app.enoeda.test/student"
    );
  });

  it("routes missing codes to the generic login failure state without exchanging a session", async () => {
    const response = await GET(request());

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://app.enoeda.test/login?error=auth_callback"
    );
  });

  it("routes rejected codes to the generic login failure state", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid code" },
    });

    const response = await GET(request("?code=expired-code"));

    expect(response.headers.get("location")).toBe(
      "https://app.enoeda.test/login?error=auth_callback"
    );
  });
});
