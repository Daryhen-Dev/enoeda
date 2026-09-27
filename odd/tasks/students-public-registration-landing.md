# Feature: students-public-registration-landing

## Goal

Land the ~100 uncommitted files sitting in the working tree: the finished public-registration feature (`/registro`, replaces invitations), its DB alignment, loose UI fixes, and repo hygiene — as 3 sequential PRs, leaving `main` green and `git status` clean of tooling noise.

## Context

- The work was implemented 2026-09-04/05 (session `kiro-public-registration-20260904`) and left uncommitted ON PURPOSE ("do not commit or push unless explicitly requested"). It is finished per session memory, but never validated end-to-end against current `main` (which moved: dojo-stories merge d3c879a, altcha removal 696f43a).
- Current blockers found by inspection:
  - Production build fails with 3 Turbopack errors: `altcha`, `altcha-lib/algorithms/pbkdf2`, `altcha-lib/frameworks/nextjs` unresolved (deps were removed from package.json by the deploy fix; feature needs them).
  - `lib/prisma/client.test.ts` import-policy scanner trips on tooling scripts (`.claude/skills/impeccable/scripts/live-browser.js`) — SKIP regex lacks tool dirs.
  - `main` carries 5 pre-existing test failures: `lib/auth/branch-context.test.ts` (4), `lib/domain/students/actions.test.ts` (1).
- The DB migration `20260904000000_public_student_registration.sql` is ALREADY APPLIED remotely (schema.prisma diff came from `db pull`).
- The working-tree `pnpm-lock.yaml` already contains the altcha entries (the consistent pair partner).
- Stash `stash@{0}` (`feat/students-directory`) holds a pre-main package.json+lock pair + vitest `passWithNoTests` + deletion of `client.runtime.test.ts` — becomes obsolete after this lands; do not apply it blindly.

## Plan (user-approved 2026-09-27)

- **PR1 hygiene** (`chore/tooling-hygiene`): extend `.gitignore` (`.codegraph/`, `.codex/`, `supabase/.temp/`, `skills-lock.json`, `/assets/*.mp4`; prior session's `.claude/.agents/.vscode/.kiro/.next` entries ride along) + fix the prisma scanner SKIP. Label: `type:chore` (must create it — repo only has type:bug/type:feature).
- **PR2 feature** (`feat/public-student-registration`): re-add `altcha`+`altcha-lib` to package.json TOGETHER with the dirty lockfile (same commit — the lesson of #169), then commit the feature core as one unit and the loose UI fixes (locations, sidebar, login-form test, sidebar-state-provider) as a second unit. Verify `pnpm install --frozen-lockfile` + `pnpm build` + suite in a CLEAN worktree before pushing.
- **PR3 test fixes** (`test/align-branch-context-students-actions`): diagnose and fix the 5 pre-existing failures; decide per case whether tests or impl are the source of truth.
- Merge sequentially (PR1 → PR2 → PR3), verify each merge's deploy before the next.

## Non-goals

- No behavior changes to the feature beyond making it build/test green.
- No new DB migrations (already applied).
- Stash handling stays a user decision at the end.

## Tasks

- [x] 1. PR1: .gitignore + scanner fix, verify, PR, merge — #170 (179793c)
- [x] 2. PR2: restore altcha pair, verify frozen-lockfile + build in clean worktree — bc402f1
- [x] 3. PR2: commit feature core + UI fixes as work units, PR, verify, merge — #171 (13e0919), commits 4e4d941 + 4b2ff69 + 9bb4886
- [x] 4. PR3: diagnose + fix the 5 main test failures, PR, verify, merge — #172 (db879eb)
- [x] 5. Close: final state report, stash recommendation, production check

## Evidence

- Production deploys: PR1/PR2/PR3 previews and production all `success` (last: 6695214281).
- Full suite on final main: 680 passed / 1 skipped / 0 failed — first fully green run.
- `pnpm build` with no `.env.local`: succeeds; `/registro` is dynamic (no build-time service secret).

## Incidents and lessons (this landing)

1. **pnpm silently rewrote the dirty lockfile**: running `pnpm vitest`/`pnpm exec` in the main tree (package.json without altcha, post-#169) triggered an implicit install that pruned altcha from the working-tree lock, destroying the parked consistent pair. Recovery: `pnpm install` with the deps restored regenerates the pair; verified with `--frozen-lockfile` in a clean worktree. Rule: never run pnpm scripts in a tree whose lock you need preserved.
2. **CRLF is pervasive on this machine**: the migration structural test broke on `\n` vs `\r\n` (fixed with `\r?\n` per repo convention); the branch-context patch needed CRLF-aware matching; `cat -A` inside a sed pipeline masked `\r` (node's `JSON.stringify` is the honest view).
3. **`/registro` prerendered statically** and instantiated the service-role client at module load — baking the branch list into HTML until the next deploy and requiring `SUPABASE_SERVICE_ROLE_KEY` at build time. Fixed with `force-dynamic`.
4. **Regex-constructor quoting trap**: `new RegExp("...\\r?\\n...")` inside shell-quoted `node -e` lost a backslash level and silently matched nothing; the literal regex form worked. Prefer literal regexes in one-liners.

## Stash disposition (pending user decision)

`stash@{0}` (`feat/students-directory: kiro: preserve pre-main local work`) is obsolete: its package.json+lock pair is superseded by #171's, the vitest tweak and runtime-test deletion are unused (suite is green without them). Recommend dropping after user confirmation.
