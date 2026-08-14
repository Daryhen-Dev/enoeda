import type { AppRole } from "@/lib/auth/authorize";

const DEFAULT_REDIRECT = "/dashboard" as const;
const OWNER_HOME = "/owner" as const;
const DASHBOARD_PREFIX = `${DEFAULT_REDIRECT}/` as const;
const OWNER_PREFIX = `${OWNER_HOME}/` as const;
const DISALLOWED_REDIRECT_CHARACTERS = /[%?\\#]/;
const PATH_TRAVERSAL_SEGMENT = /(^|\/)\.\.?($|\/)/;

declare const safeRedirectBrand: unique symbol;

export type SafeRedirect = string & {
  readonly [safeRedirectBrand]: true;
};

/**
 * Determine the persona home route based on role names.
 * Owner gets /owner; admin/teacher gets /dashboard.
 * Falls back to /dashboard when no roles are present.
 */
export function getPersonaHome(roles: AppRole[]): SafeRedirect {
  if (roles.includes("owner" as AppRole)) {
    return OWNER_HOME as SafeRedirect;
  }
  return DEFAULT_REDIRECT as SafeRedirect;
}

/** Check if a path belongs to the /owner prefix. */
function isOwnerPath(value: string): boolean {
  return value === OWNER_HOME || value.startsWith(OWNER_PREFIX);
}

/** Check if a path belongs to the /dashboard prefix. */
function isDashboardPath(value: string): boolean {
  return value === DEFAULT_REDIRECT || value.startsWith(DASHBOARD_PREFIX);
}

/** Check if a path is within one of the allowed app prefixes. */
function isAllowedPath(value: string): boolean {
  return isDashboardPath(value) || isOwnerPath(value);
}

/**
 * Validate and return a safe redirect path.
 *
 * When `roles` is provided, enforces persona boundaries:
 * - Owner can only redirect to /owner paths
 * - Admin/teacher can only redirect to /dashboard paths
 * - Invalid redirects fall back to the persona home
 *
 * Without roles, accepts any allowed prefix (/dashboard or /owner).
 */
export function getSafeRedirect(value: unknown, roles?: AppRole[]): SafeRedirect {
  const personaHome = roles ? getPersonaHome(roles) : DEFAULT_REDIRECT;

  if (
    typeof value !== "string" ||
    value.length === 0 ||
    DISALLOWED_REDIRECT_CHARACTERS.test(value) ||
    PATH_TRAVERSAL_SEGMENT.test(value) ||
    !isAllowedPath(value)
  ) {
    return personaHome as SafeRedirect;
  }

  // When roles are provided, enforce persona boundaries
  if (roles) {
    const isOwner = roles.includes("owner" as AppRole);
    if (isOwner && !isOwnerPath(value)) {
      return OWNER_HOME as SafeRedirect;
    }
    if (!isOwner && isOwnerPath(value)) {
      return DEFAULT_REDIRECT as SafeRedirect;
    }
  }

  return value as SafeRedirect;
}
