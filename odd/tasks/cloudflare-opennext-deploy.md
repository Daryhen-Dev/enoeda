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

