import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  CHANGE_PASSWORD_PATH,
  findRouteGuard,
  hasRequiredRole,
  isPublicPath,
  isStudentPath,
  parseRoleAssignments,
  roleNamesFrom,
} from "@/lib/auth/authorize";
import { getPersonaHome } from "@/lib/auth/redirect";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";

function mustChangePassword(user: { app_metadata?: Record<string, unknown> }): boolean {
  return user.app_metadata?.must_change_password === true;
}

function withRefreshedCookies(
  response: NextResponse,
  supabaseResponse: NextResponse
): NextResponse {
  supabaseResponse.cookies
    .getAll()
    .forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths bypass authentication entirely
  if (isPublicPath(pathname)) {
    return await updateSession(request);
  }

  // Every non-public path resolves the session so the forced
  // password-change check runs regardless of whether the path has a
  // persona route guard (e.g. "/" has no guard but must still be gated).
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getSupabasePublicConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return withRefreshedCookies(NextResponse.redirect(loginUrl), supabaseResponse);
  }

  const isChangePasswordPath = pathname === CHANGE_PASSWORD_PATH;
  const requiresPasswordChange = mustChangePassword(user);

  if (requiresPasswordChange && !isChangePasswordPath) {
    const changePasswordUrl = request.nextUrl.clone();
    changePasswordUrl.pathname = CHANGE_PASSWORD_PATH;
    return withRefreshedCookies(
      NextResponse.redirect(changePasswordUrl),
      supabaseResponse
    );
  }

  if (isChangePasswordPath) {
    if (requiresPasswordChange) {
      return supabaseResponse;
    }
    const { data: rolesData } = await supabase.rpc("current_roles");
    const userRoles = roleNamesFrom(parseRoleAssignments(rolesData));
    const personaHomeUrl = request.nextUrl.clone();
    personaHomeUrl.pathname = getPersonaHome(userRoles);
    return withRefreshedCookies(
      NextResponse.redirect(personaHomeUrl),
      supabaseResponse
    );
  }

  if (isStudentPath(pathname)) {
    const { data: student, error } = await supabase
      .from("students")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (error || student === null) {
      return withRefreshedCookies(
        new NextResponse("Forbidden", { status: 403 }),
        supabaseResponse
      );
    }

    return supabaseResponse;
  }

  const guard = findRouteGuard(pathname);
  if (!guard) {
    return supabaseResponse;
  }

  const { data: rolesData } = await supabase.rpc("current_roles");
  const userRoles = roleNamesFrom(parseRoleAssignments(rolesData));

  if (!hasRequiredRole(userRoles, guard.roles)) {
    return withRefreshedCookies(
      new NextResponse("Forbidden", { status: 403 }),
      supabaseResponse
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
