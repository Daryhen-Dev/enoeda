/**
 * URL parameter preservation utilities for branch context redirects.
 *
 * Ensures all non-branch query params are preserved during redirects.
 */

/**
 * Build a redirect URL preserving all existing query params except `branch`,
 * then appending the resolved branchId.
 */
export function buildBranchRedirectUrl(
  basePath: string,
  params: Record<string, string | undefined>,
  branchId: string
): string {
  const redirectParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "branch" && value) redirectParams.set(key, value);
  }
  redirectParams.set("branch", branchId);
  return `${basePath}?${redirectParams.toString()}`;
}

/**
 * Extract non-branch params from a search params record.
 */
export function extractNonBranchParams(
  params: Record<string, string | undefined>
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key !== "branch" && value) result[key] = value;
  }
  return result;
}
