import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  isPublicPath,
  findRouteGuard,
  hasRequiredRole,
  parseRoleAssignments,
  roleNamesFrom,
  CHANGE_PASSWORD_PATH,
} from "@/lib/auth/authorize";
import { getPersonaHome } from "@/lib/auth/redirect";
import { createServerClient } from "@supabase/ssr";

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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated → redirect to login
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);
    return withRefreshedCookies(NextResponse.redirect(loginUrl), supabaseResponse);
  }

  const isChangePasswordPath = pathname === CHANGE_PASSWORD_PATH;
  const requiresPasswordChange = mustChangePassword(user);

  // Force accounts created with a temporary password to /change-password
  // before reaching any other route — guarded or not.
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
      // Password not changed yet — allow rendering the change-password page.
      return supabaseResponse;
    }
    // Already changed — never let this page stay reachable indefinitely.
    const { data: rolesData } = await supabase.rpc("current_roles");
    const userRoles = roleNamesFrom(parseRoleAssignments(rolesData));
    const personaHomeUrl = request.nextUrl.clone();
    personaHomeUrl.pathname = getPersonaHome(userRoles);
    return withRefreshedCookies(
      NextResponse.redirect(personaHomeUrl),
      supabaseResponse
    );
  }

  // Check if this path has a persona route guard
  const guard = findRouteGuard(pathname);
  if (!guard) {
    // No guard configured — allow with session refresh
    return supabaseResponse;
  }

  // Fetch current roles via RPC (composite rows: { role, branch_id })
  const { data: rolesData } = await supabase.rpc("current_roles");
  const userRoles = roleNamesFrom(parseRoleAssignments(rolesData));

  // Check role authorization against persona prefix guard
  if (!hasRequiredRole(userRoles, guard.roles)) {
    // 403 — user is authenticated but lacks required role for this persona
    return withRefreshedCookies(
      new NextResponse("Forbidden", { status: 403 }),
      supabaseResponse
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
