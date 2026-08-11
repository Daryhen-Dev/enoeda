import { createClient } from "@/lib/supabase/server";

/** Application roles matching the database role_enum type. */
export const APP_ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher",
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

export const AUTHORIZATION_REASONS = {
  UNAUTHENTICATED: "unauthenticated",
  UNAUTHORIZED: "unauthorized",
  NO_ROLES: "no_roles",
} as const;

export type AuthorizationReason =
  (typeof AUTHORIZATION_REASONS)[keyof typeof AUTHORIZATION_REASONS];

const APP_ROLE_VALUES = Object.values(APP_ROLES);

/** Route protection: path prefix → required roles (any one suffices). */
export interface RouteGuard {
  pathPrefix: string;
  roles: AppRole[];
}

/** Dashboard routes require at least one active role. */
export const ROUTE_GUARDS: RouteGuard[] = [
  { pathPrefix: "/dashboard", roles: [APP_ROLES.ADMIN, APP_ROLES.TEACHER] },
];

/** Paths that are always public — no authentication required. */
export const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/api/auth",
  "/_next",
  "/favicon.ico",
] as const;

function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLE_VALUES.some((role) => role === value);
}

/** Parse only role values declared by the application. */
export function parseAppRoles(value: unknown): AppRole[] {
  return Array.isArray(value) ? value.filter(isAppRole) : [];
}

/** Check if a path is public (no auth required). */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((prefix) => matchesPathPrefix(pathname, prefix));
}

/** Find the route guard applicable to a given path. */
export function findRouteGuard(pathname: string): RouteGuard | undefined {
  return ROUTE_GUARDS.find((guard) => matchesPathPrefix(pathname, guard.pathPrefix));
}

/** Check if user roles satisfy the guard (any one of required roles). */
export function hasRequiredRole(
  userRoles: AppRole[],
  requiredRoles: AppRole[]
): boolean {
  return requiredRoles.some((role) => userRoles.includes(role));
}

/**
 * Fetch current user's active roles from DB via public.current_roles() RPC.
 * Returns empty array if not authenticated or on error.
 */
export async function fetchCurrentRoles(): Promise<AppRole[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_roles");
  if (error || !data) return [];
  return parseAppRoles(data);
}

/** Authorization result for middleware use. */
export interface AuthorizationResult {
  authorized: boolean;
  reason?: AuthorizationReason;
  roles: AppRole[];
}

/** Authorize a request against route guards (for protected paths). */
export async function authorizeRequest(
  pathname: string
): Promise<AuthorizationResult> {
  const guard = findRouteGuard(pathname);
  if (!guard) return { authorized: true, roles: [] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      authorized: false,
      reason: AUTHORIZATION_REASONS.UNAUTHENTICATED,
      roles: [],
    };
  }

  const roles = await fetchCurrentRoles();
  if (roles.length === 0) {
    return {
      authorized: false,
      reason: AUTHORIZATION_REASONS.NO_ROLES,
      roles: [],
    };
  }
  if (!hasRequiredRole(roles, guard.roles)) {
    return {
      authorized: false,
      reason: AUTHORIZATION_REASONS.UNAUTHORIZED,
      roles,
    };
  }

  return { authorized: true, roles };
}
