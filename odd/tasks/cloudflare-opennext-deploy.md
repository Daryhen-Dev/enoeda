# Feature: Cloudflare OpenNext deploy configuration

## Goal

Make Cloudflare Workers Builds deploy the Next.js app deterministically by
committing the OpenNext Cloudflare configuration to the repository, instead of
relying on `@opennextjs/cloudflare migrate` running non-interactively on every
CI build.

## Root cause 1 — deploy command failed (diagnosed 2026-09-27)

Cloudflare Workers Builds detected Next.js without a committed `wrangler.jsonc`
and ran `@opennextjs/cloudflare migrate` in CI. That step installs `wrangler`
as a devDependency, pulling `esbuild` and `workerd`, whose postinstall scripts
pnpm 11 blocks because they were not in `allowBuilds` in `pnpm-workspace.yaml`
→ `[ERR_PNPM_IGNORED_BUILDS]` → deploy failed.

Fix: commit `wrangler.jsonc` + `open-next.config.ts`, add `wrangler` and
`@opennextjs/cloudflare` as devDependencies, and allow `esbuild` + `workerd`
build scripts in `pnpm-workspace.yaml`.

## Root cause 2 — OpenNext bundle failed on `pg-cloudflare`

Surfaced only after root cause 1 was fixed, when building the Worker:

```
✘ [ERROR] Could not resolve "pg-cloudflare"
    .../pg/lib/stream.js:41   const { CloudflareSocket } = require('pg-cloudflare')
    The module "./dist/index.js" was not found: pg-cloudflare/package.json:16
```

`pg/lib/stream.js` gates `require('pg-cloudflare')` behind a runtime check.
Next's file tracer (`@vercel/nft`) cannot resolve that dynamic require
statically, so it copies only the non-workerd stub (`dist/empty.js`). The
OpenNext esbuild pass runs with the `workerd` condition and needs the real
`dist/index.js` / `esm/index.mjs`, which were never copied.

Upstream: https://github.com/opennextjs/opennextjs-cloudflare/issues/1214 (open)

Fix (the workaround documented in that issue, verified here): add
`pg-cloudflare` as a direct dependency (so the root `node_modules/pg-cloudflare`
path exists — it was previously only a transitive optional dependency under
pnpm's virtual store) and declare `outputFileTracingIncludes` in `next.config.ts`
for `pg-cloudflare/dist/**` and `pg-cloudflare/esm/**`.

## Root cause 3 — deploy failed after the bundle built (Workers Builds command)

With root causes 1 and 2 fixed, the build step succeeded but the deploy step
failed:

```
Executing user build command: pnpm run build      <- only `next build`
Executing user deploy command: npx wrangler deploy
OpenNext project detected, calling `opennextjs-cloudflare deploy`
ERROR Could not find compiled Open Next config, did you run the build command?
```

Workers Builds was configured with the build command `pnpm run build`, which
runs only `next build` and never adapts the app for Workers. `wrangler deploy`
detects OpenNext and delegates to `opennextjs-cloudflare deploy`, which needs
the bundle produced by `opennextjs-cloudflare build` — a step that never ran.

Fix: set the Workers Builds **build command** to `npx opennextjs-cloudflare build`
(leave the deploy command as `npx wrangler deploy`).

This is a dashboard setting, not repository configuration. It cannot be fixed by
pointing the `build` script at `opennextjs-cloudflare build`, because that
command invokes `pnpm run build` internally
(`@opennextjs/aws/dist/build/buildNextApp.js`) — it would recurse infinitely.
The escape hatch is `--skipNextBuild` (`SKIP_NEXT_APP_BUILD`), deliberately not
used here in order to stay on the documented path.

## Missing standard OpenNext configuration

`migrate` was never run to completion (it was the step that failed in CI), so the
repo was also missing the standard OpenNext setup. Added:

- `preview` / `deploy` / `upload` / `cf-typegen` scripts.
- `public/_headers` with immutable caching for `/_next/static/*`.
- `.gitignore` entries for `.wrangler` and `.dev.vars*` (the latter keeps local
  Worker secrets out of git).

`build` intentionally stays `next build`, per the official documentation.

## Root cause 4 — the first successful deploy wiped the Worker's variables

The first green build shipped the app, but `wrangler deploy` deleted every
variable that had been set in the dashboard. Before the deploy the Worker had six
`plain_text` bindings (`APP_URL`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`); afterwards only `ASSETS` and
`WORKER_SELF_REFERENCE` remained.

Cause, per Cloudflare docs: `wrangler deploy` uses `--keep-vars` defaulting to
`false`, which *"will delete all vars before setting those found in the Wrangler
configuration"*. Since `wrangler.jsonc` declares no `vars`, everything the
dashboard held was removed. Secrets are never deleted by a deployment.

The app then returned `HTTP 500` on every route, including the static `/`:
`lib/supabase/config.ts` throws when `NEXT_PUBLIC_SUPABASE_URL` or
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, and `middleware.ts` calls
`getSupabasePublicConfig()` through `updateSession` on every request.

Fix: set `"keep_vars": true` in `wrangler.jsonc`. Sensitive values should also
live in secrets (Settings > Variables and Secrets) rather than as plain text,
which makes them both deploy-proof and encrypted.

## Verification

Reproduced in a CI-equivalent Linux container (node 24 + pnpm 11.21, repo on a
native Linux filesystem) because the OpenNext build cannot run on Windows:
esbuild cannot follow pnpm's relative symlinks under the Windows filesystem
("Access is denied"), which is environmental, not a project defect.

`pnpm install --frozen-lockfile` → `opennextjs-cloudflare build` →
`wrangler deploy --dry-run` all pass, with `.env.local` absent to match CI.
Upload: 17049 KiB / gzip 4207 KiB, 110 asset files, bindings
`WORKER_SELF_REFERENCE` + `ASSETS`.

## Deliberate omissions (documented in-file, not enabled)

- R2 incremental cache (ISR): requires creating the
  `enoeda-opennext-cache` bucket first. Instructions are commented in
  `wrangler.jsonc` and `open-next.config.ts`.
- Cloudflare Image Optimization binding (`images`): not enabled to avoid
  unexpected per-request billing.

## Required Cloudflare configuration (dashboard, not in repo)

Build-time variables (needed because `NEXT_PUBLIC_*` is inlined by Next):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Runtime variables/secrets:

- `DATABASE_URL` (server secret)
- `SUPABASE_SERVICE_ROLE_KEY` (server secret)
- `ALTCHA_HMAC_SECRET` (server secret)
- `PUBLIC_REGISTRATION_HASH_SECRET` (server secret)
- `ALTCHA_CHALLENGE_TTL_SECONDS` (optional)

## Runtime database note

`lib/prisma/client.ts` uses `PrismaPg` from `@prisma/adapter-pg`, which rides on
`pg`. With `pg-cloudflare` now bundled, `pg` uses the Workers socket
implementation, so this is a viable Workers path. Nonetheless, Cloudflare
recommends fronting Postgres with a Hyperdrive binding for connection pooling;
validate real DB calls with a preview deploy before treating this as production
ready.

## Tasks

- [x] 1. Create feature branch and ODD tracking docs
- [x] 2. Install `wrangler` + `@opennextjs/cloudflare` as devDependencies
- [x] 3. Approve `esbuild` + `workerd` build scripts in `pnpm-workspace.yaml`
- [x] 4. Create `wrangler.jsonc` + `open-next.config.ts`
- [x] 5. Fix `pg-cloudflare` tracing (opennext issue #1214)
- [x] 6. Verify end-to-end in CI-equivalent Linux container
- [x] 7. Work-unit commit on the feature branch — `cb5be89`

## Commit evidence

- `cb5be89` — chore(deploy): add OpenNext Cloudflare configuration
  (wrangler.jsonc, open-next.config.ts, devDeps, allowBuilds, pg-cloudflare tracing)
- `8217526` — docs(odd): record commit evidence for the Cloudflare OpenNext deploy
- `236df3e` — squash merge of PR #174 into `main`.

### Unintended payload in the squash — corrected 2026-09-28

The branch was created from a local `main` that had drifted two commits ahead of
`origin/main` (`aaf3fab`, `2e5f107`), and those commits were never pushed. They
travelled with the branch, so the PR diff included them and the squash brought
the unrelated footer collaborators work into `main` under this commit message.
See `odd/tasks/footer-colaboradores.md` for the full record. The user chose to
keep it on `main` and correct the record rather than revert.

Lesson: compare against `origin/<base>` before branching, not just the local
base branch.

