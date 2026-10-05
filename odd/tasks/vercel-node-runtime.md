# Back to Vercel (Node runtime)

## Problem

Cloudflare Workers free plan caps CPU at 10 ms per request; the app uses
40-660 ms (Next.js + Prisma), so Workers returned 503 `exceededCpu` in bursts.
Decision (user, 2026-10-02): deploy on Vercel Hobby again.

Vercel production deploys fail since `236df3e` (OpenNext config):

```
The framework produced an invalid deployment package for a Serverless
Function. Typically this means that the framework produces files in
symlinked directories.
```

## Root cause

`next.config.ts` `outputFileTracingIncludes` forces
`./node_modules/pg-cloudflare/**` into every function trace. Under pnpm that
path is a symlink into `.pnpm/`, so Vercel's function packager gets a
symlinked directory and rejects the bundle. It was added only for the
OpenNext/workerd bundle.

## Tasks

- [x] 1. Node runtime: drop `outputFileTracingIncludes`, Prisma generator back
      to the Node target (remove `runtime = "workerd"`), restore the Prisma
      singleton in `withUser` (correct on Node), update tests.
- [x] 2. Verify: clean worktree `pnpm install --frozen-lockfile`, tests, tsc,
      `next build`, no symlinked trace entries.
- [x] 3. User: merge, confirm Vercel deploy green, move the domain (DNS only).
      Done 2026-10-04/05: production deploys green, `enoedadojo.com` served by
      Vercel (Namecheap BasicDNS, `www` primary, apex 308 to `www`).
- [x] 4. Remove Cloudflare config/deps and disable Workers Builds. Repo side
      done in `odd/tasks/remove-cloudflare-config.md`; the user reported
      deleting everything in Cloudflare, including the zone.

## Evidence

- Task 1: `8a0265b` fix(deploy): target the Node.js runtime for Vercel.
- Checks: vitest 695 passed / 1 skipped; `client.runtime.test.ts` against the
  real DB now passes (was failing on the workerd Wasm); tsc and eslint clean;
  clean-worktree `pnpm install --frozen-lockfile` + `next build` ok; 0 traces
  include `pg-cloudflare/esm`.
- Not verifiable locally: Vercel's function packager itself (needs a deploy).
