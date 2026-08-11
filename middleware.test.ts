import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CookieToSet {
  name: string;
  value: string;
  options?: {
    httpOnly?: boolean;
    path?: string;
  };
}

interface ServerClientOptions {
  cookies: {
    setAll(cookies: CookieToSet[]): void;
  };
}

interface MockUser {
  id: string;
}

interface MockSupabaseClient {
  auth: {
    getUser(): Promise<{ data: { user: MockUser | null } }>;
  };
  rpc(name: string): Promise<{ data: unknown }>;
}

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn<
    (
      url: string,
      key: string,
      options: ServerClientOptions
    ) => MockSupabaseClient
  >(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: vi.fn(),
}));

import { middleware } from "./middleware";

const REFRESHED_COOKIE: CookieToSet = {
  name: "sb-refresh-token",
  value: "refreshed-session",
  options: { httpOnly: true, path: "/" },
};

function request(pathname: string): NextRequest {
  return new NextRequest(`https://enoeda.test${pathname}`);
}

function stageSessionRefresh(user: MockUser | null, roles: unknown): void {
  createServerClientMock.mockImplementation((_url, _key, options) => ({
    auth: {
      async getUser() {
        options.cookies.setAll([REFRESHED_COOKIE]);
        return { data: { user } };
      },
    },
    async rpc() {
      return { data: roles };
    },
  }));
}

describe("middleware session refresh responses", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("retains staged refresh cookies on the login redirect response", async () => {
    stageSessionRefresh(null, []);

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.cookies.get(REFRESHED_COOKIE.name)?.value).toBe(
      REFRESHED_COOKIE.value
    );
  });

  it("retains staged refresh cookies on the forbidden response", async () => {
    stageSessionRefresh({ id: "user-1" }, []);

    const response = await middleware(request("/dashboard"));

    expect(response.status).toBe(403);
    expect(response.cookies.get(REFRESHED_COOKIE.name)?.value).toBe(
      REFRESHED_COOKIE.value
    );
  });
});