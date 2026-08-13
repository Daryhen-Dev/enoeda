const DEFAULT_REDIRECT = "/dashboard" as const
const REDIRECT_PREFIX = `${DEFAULT_REDIRECT}/` as const
const DISALLOWED_REDIRECT_CHARACTERS = /[%?\\#]/
const PATH_TRAVERSAL_SEGMENT = /(^|\/)\.\.?($|\/)/

declare const safeRedirectBrand: unique symbol

export type SafeRedirect = string & {
  readonly [safeRedirectBrand]: true
}

export function getSafeRedirect(value: unknown): SafeRedirect {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    DISALLOWED_REDIRECT_CHARACTERS.test(value) ||
    PATH_TRAVERSAL_SEGMENT.test(value) ||
    (value !== DEFAULT_REDIRECT && !value.startsWith(REDIRECT_PREFIX))
  ) {
    return DEFAULT_REDIRECT as SafeRedirect
  }

  return value as SafeRedirect
}
