# Branch-scoped belt promotion requirements

User request: an admin must be able to edit the number of attended classes
required to move up a belt, from a dedicated section.

## Findings
- `discipline_levels.required_attended_sessions` already holds the requirement,
  but it is one global value per level and RLS allows writes only to owners
  ("Owner write discipline_levels").
- The owner manages levels at `/owner/disciplines/[id]/levels`; admins have no
  equivalent screen.
- The requirement is read in `lib/domain/progress/actions.ts`
  (`getStudentProgressSummary` and `getPromotionEligibility`) and surfaced in
  the student discipline card and the promote dialog.

## Decisions (user-confirmed)
- The requirement is per branch: a branch may override a level's requirement;
  without an override it inherits the owner's general value.
- Admins edit ONLY the required classes for their own branch (and can reset to
  the general value). Level name, color, order, creation and initial level stay
  owner-only. No admin change can affect another branch.

## Tasks
- [x] T1: Migration: `branch_level_requirements` (branch_id, level_id,
      required_attended_sessions >= 0, unique per branch+level, audit columns)
      with RLS: owner all, branch admin write, branch staff read. Prisma sync.
- [x] T2: Effective requirement resolution (override ?? level value) in
      getStudentProgressSummary and getPromotionEligibility, branch-scoped.
- [x] T3: Actions: list branch level requirements, set override, clear override
      (admin of branch or owner).
- [x] T4: Admin section `/dashboard/belts` (nav "Cinturones", admin-only):
      per discipline, levels with general value, branch value, edit and reset.
- [x] T5: Tests (migration, resolution, actions, section), tsc, lint.
- [x] T6: Apply migration (user-authorized in a later step), commit.

## Evidence
- Worker: gentle-ai-worker. Migration 20260908000000 (transactional, no
  DROP/TRUNCATE): branch_level_requirements with FK cascades, CHECK >= 0,
  UNIQUE (branch_id, level_id), level_id index, set_updated_at trigger,
  RLS ENABLE+FORCE (owner all, branch admin all, branch teacher select),
  grants mirroring class_series. Prisma model + regenerated client.
- Resolution: pure helpers in lib/domain/levels/branch-requirements.ts;
  getStudentProgressSummary and getPromotionEligibility read the branch
  override inside the same RLS transaction (override ?? general).
- Actions: listBranchLevelRequirements, setBranchLevelRequirement (0..1000,
  upsert, updated_by), clearBranchLevelRequirement; guard owner or admin of
  that branch, teachers rejected.
- UI: /dashboard/belts + components/belts/branch-level-requirements-list.tsx;
  nav "Cinturones" admin-only in app-sidebar.
- Parent review: migration SQL read; RLS mirrors the class_series pattern;
  set_updated_at exists (20260812000000); app guard verified.
- Checks: prisma generate OK; tsc --noEmit clean; vitest 814 passed / 1
  skipped / 0 failed; eslint clean on 13 changed non-generated files.
- Migration 20260908000000 APPLIED to the Supabase DB (user-authorized):
  table exists, RLS enabled + forced, 3 policies, updated_at trigger, both
  constraints present, 0 rows.
- Live RLS probe (rolled-back transactions, real non-owner branch admin):
  INSERT into own branch allowed; INSERT into another branch denied with
  42501; 0 rows left behind.
- Extra fix found during review: lib/prisma/generated/ is gitignored, so new
  generated model files (class_series.ts since ecef089, and
  branch_level_requirements.ts) were never committed while models.ts
  re-exports them. Type-only re-exports + @ts-nocheck kept builds green, but
  the tracked client was incomplete; both files force-added.
- Pre-merge verification (gentle-ai-verify): tsc clean; vitest 814 passed /
  1 skipped; eslint clean on 13 files; tree clean.
- Commits: 91e0787 feat(belts): branch admins set the classes required to
  move up a belt; a5051e5 fix(prisma): track generated client models.
