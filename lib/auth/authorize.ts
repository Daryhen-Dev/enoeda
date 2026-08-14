/**
 * Pure authorization utilities — Edge-safe, no I/O, no server imports.
 *
 * This module defines application roles, route guards, and pure predicate
 * functions. It is safe to import from middleware (Edge Runtime) and from
 * any server or client module that needs role constants or path checks.
 *
 * Server-only role fetching (I/O) lives in `lib/auth/server-roles.ts` and
 * `lib/auth/identity-resolver.ts` — never re-add `createClient` or any
 * network call here.
 */

/** Application roles matching the database role_enum type. */
export const APP_ROLES = {
  ADMIN: "admin",
  TEACHER: "teacher",
  OWNER: "owner",
} as const;

export type AppRole = (typeof APP_ROLES)[keyof typeof APP_ROLES];

/** Branch-scoped role assignment from current_roles() composite rows. */
export interface AppRoleAssignment {
  role: AppRole;
  branchId: string | null;
}

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

/**
 * Route guards enforce persona separation:
 * - /owner → owner only (control plane)
 * - /dashboard → admin|teacher only (operational plane, owner excluded)
 */
export const ROUTE_GUARDS: RouteGuard[] = [
  { pathPrefix: "/owner", roles: [APP_ROLES.OWNER] },
  { pathPrefix: "/dashboard", roles: [APP_ROLES.ADMIN, APP_ROLES.TEACHER] },
];

/** Forced password-change screen for accounts created by owner/admin. */
export const CHANGE_PASSWORD_PATH = "/change-password" as const;

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

/** Parse only role values declared by the application (flat string array). */
export function parseAppRoles(value: unknown): AppRole[] {
  return Array.isArray(value) ? value.filter(isAppRole) : [];
}

/**
 * Parse composite RPC rows from current_roles() into AppRoleAssignment[].
 * Expected shape: Array<{ role: string; branch_id: string | null }>
 * Filters out unrecognized roles.
 */
export function parseRoleAssignments(value: unknown): AppRoleAssignment[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (row): row is { role: string; branch_id: string | null } =>
        typeof row === "object" &&
        row !== null &&
        "role" in row &&
        isAppRole((row as Record<string, unknown>).role)
    )
    .map((row) => ({
      role: row.role as AppRole,
      branchId: row.branch_id ?? null,
    }));
}

/** Extract unique role names from assignments. */
export function roleNamesFrom(assignments: AppRoleAssignment[]): AppRole[] {
  return [...new Set(assignments.map((a) => a.role))];
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


