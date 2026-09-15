import { NextRequest, NextResponse } from "next/server";
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

interface StudentLookupResult {
  data: { id: string } | null;
  error: { message: string } | null;
}

interface MockSupabaseClient {
  auth: {
    getUser(): Promise<{ data: { user: MockUser | null } }>;
  };
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<StudentLookupResult>;
      };
    };
  };
  rpc(name: string): Promise<{ data: unknown }>;
}

const {
  createServerClientMock,
  currentRolesMock,
  studentFilterMock,
  studentMaybeSingleMock,
  studentSelectMock,
  studentTableMock,
  updateSessionMock,
} = vi.hoisted(() => ({
  createServerClientMock: vi.fn<
    (
      url: string,
      key: string,
      options: ServerClientOptions
    ) => MockSupabaseClient
  >(),
  currentRolesMock: vi.fn<(name: string) => Promise<{ data: unknown }>>(),
  studentFilterMock: vi.fn(),
  studentMaybeSingleMock: vi.fn<() => Promise<StudentLookupResult>>(),
  studentSelectMock: vi.fn(),
  studentTableMock: vi.fn(),
  updateSessionMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: updateSessionMock,
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabasePublicConfig: () => ({
    anonKey: "test-anon-key",
    url: "https://enoeda.test",
  }),
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

function stageSessionRefresh(
  user: MockUser | null,
  roles: unknown,
  studentLookup: StudentLookupResult = { data: null, error: null }
): void {
  currentRolesMock.mockResolvedValue({ data: roles });
  studentMaybeSingleMock.mockResolvedValue(studentLookup);
  studentFilterMock.mockReturnValue({ maybeSingle: studentMaybeSingleMock });
  studentSelectMock.mockReturnValue({ eq: studentFilterMock });
  studentTableMock.mockReturnValue({ select: studentSelectMock });

  createServerClientMock.mockImplementation((_url, _key, options) => ({
    auth: {
      async getUser() {
        options.cookies.setAll([REFRESHED_COOKIE]);
        return { data: { user } };
      },
    },
    from: studentTableMock,
    rpc: currentRolesMock,
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

  it("delegates enrollment requests to the public session update", async () => {
    const routeRequest = request("/enroll");
    const publicResponse = NextResponse.next({ request: routeRequest });
    updateSessionMock.mockResolvedValue(publicResponse);

    const response = await middleware(routeRequest);

    expect(updateSessionMock).toHaveBeenCalledWith(routeRequest);
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(response).toBe(publicResponse);
  });

  it("delegates public media requests without starting authentication", async () => {
    const routeRequest = request("/media/dojo-stories/story-01.mp4");
    const publicResponse = NextResponse.next({ request: routeRequest });
    updateSessionMock.mockResolvedValue(publicResponse);

    const response = await middleware(routeRequest);

    expect(updateSessionMock).toHaveBeenCalledWith(routeRequest);
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(response).toBe(publicResponse);
  });

  it("redirects anonymous student requests to login", async () => {
    stageSessionRefresh(null, []);

    const response = await middleware(request("/student"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
      "/login"
    );
    expect(
      new URL(response.headers.get("location") ?? "").searchParams.get(
        "redirect"
      )
    ).toBe("/student");
    expect(response.cookies.get(REFRESHED_COOKIE.name)?.value).toBe(
      REFRESHED_COOKIE.value
    );
  });

  it("allows linked students without resolving staff roles", async () => {
    stageSessionRefresh(
      { id: "student-auth-user" },
      [],
      { data: { id: "student-profile" }, error: null }
    );

    const response = await middleware(request("/student"));

    expect(response.status).toBe(200);
    expect(studentTableMock).toHaveBeenCalledWith("students");
    expect(studentSelectMock).toHaveBeenCalledWith("id");
    expect(studentFilterMock).toHaveBeenCalledWith(
      "auth_user_id",
      "student-auth-user"
    );
    expect(currentRolesMock).not.toHaveBeenCalled();
  });

  it("returns a cookie-preserving forbidden response for unlinked student users", async () => {
    stageSessionRefresh({ id: "unlinked-user" }, []);

    const response = await middleware(request("/student"));

    expect(response.status).toBe(403);
    expect(response.cookies.get(REFRESHED_COOKIE.name)?.value).toBe(
      REFRESHED_COOKIE.value
    );
    expect(currentRolesMock).not.toHaveBeenCalled();
  });

  it("delegates anonymous El camino requests to the public session update", async () => {
    const routeRequest = request("/el-camino");
    const publicResponse = NextResponse.next({ request: routeRequest });
    updateSessionMock.mockResolvedValue(publicResponse);

    const response = await middleware(routeRequest);

    expect(updateSessionMock).toHaveBeenCalledWith(routeRequest);
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(response).toBe(publicResponse);
  });
});
