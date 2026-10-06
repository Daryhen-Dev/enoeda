/**
 * Pure helpers for branch-scoped level requirement resolution.
 *
 * A branch may override a level's `required_attended_sessions`. Without an
 * override row the level's general (owner-managed) value applies. These
 * helpers are the single source of truth for that resolution and are shared
 * by the levels domain (branch admin UI) and the progress domain
 * (promotion eligibility).
 */

/** A single override row as read from branch_level_requirements. */
export interface BranchLevelRequirementRow {
  branch_id: string;
  level_id: string;
  required_attended_sessions: number;
}

/**
 * Resolves the effective required sessions for a level on a branch.
 * The branch override wins whenever it is present; otherwise the general
 * (owner) value applies.
 */
export function resolveRequiredSessions(
  generalValue: number,
  overrideValue: number | null | undefined
): number {
  return overrideValue ?? generalValue;
}

/**
 * Builds a lookup of level_id -> required_attended_sessions from override
 * rows, ignoring rows that belong to a different branch (defense in depth:
 * RLS already filters, but a stale or mis-scoped read must never leak
 * another branch's requirement).
 */
export function buildBranchRequirementMap(
  rows: readonly BranchLevelRequirementRow[],
  branchId: string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.branch_id !== branchId) continue;
    map.set(row.level_id, row.required_attended_sessions);
  }
  return map;
}
