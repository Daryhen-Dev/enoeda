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

  it("exchanges a valid code and redirects to the fixed enrollment continuation", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(request("?code=invite-code&next=%2Fenroll"));

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("invite-code");
    expect(response.headers.get("location")).toBe("https://app.enoeda.test/enroll");
  });

  it("rejects an external callback next target after successful session exchange", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(
      request("?code=invite-code&next=https%3A%2F%2Fevil.example%2Fsteal")
    );

    expect(response.headers.get("location")).toBe("https://app.enoeda.test/enroll");
  });

  it("routes missing codes to the generic login failure state without exchanging a session", async () => {
    const response = await GET(request("?next=%2Fenroll"));

    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(
      "https://app.enoeda.test/login?error=auth_callback"
    );
  });

  it("does not continue enrollment when Supabase rejects the code", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid code" },
    });

    const response = await GET(request("?code=expired-code"));

    expect(response.headers.get("location")).toBe(
      "https://app.enoeda.test/login?error=auth_callback"
    );
  });
});
