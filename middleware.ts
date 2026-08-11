import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  isPublicPath,
  findRouteGuard,
  hasRequiredRole,
  parseAppRoles,
} from "@/lib/auth/authorize";
import { createServerClient } from "@supabase/ssr";

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

  // Check if this path has a route guard
  const guard = findRouteGuard(pathname);
  if (!guard) {
    // No guard configured — allow with session refresh
    return await updateSession(request);
  }

  // For guarded routes: refresh session then check roles
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

  // Fetch current roles via RPC
  const { data: roles } = await supabase.rpc("current_roles");
  const userRoles = parseAppRoles(roles);

  // Check role authorization
  if (!hasRequiredRole(userRoles, guard.roles)) {
    // 403 — user is authenticated but lacks required role
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
