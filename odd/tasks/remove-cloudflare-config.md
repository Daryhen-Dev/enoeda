# Remove Cloudflare / OpenNext configuration

## Problem

Production moved back to Vercel (Node runtime) and the domain now lives on
Vercel via Namecheap DNS. The repo still carries the Cloudflare Workers
deployment path:

- `wrangler.jsonc`, `open-next.config.ts`, `public/_headers` (Workers static
  asset headers; Vercel caches `/_next/static` immutably by default).
- `package.json` scripts `preview`, `deploy`, `upload`, `cf-typegen`.
- `package.json` deps `@opennextjs/cloudflare`, `wrangler`, `pg-cloudflare`
  (the last one was only added as a direct dep for the OpenNext bundle; `pg`
  still lists it as an optional dependency of its own).
- `pnpm-workspace.yaml` build allowance for `workerd`.
- Cloudflare Workers Builds fails on every push by design (workerd runtime was
  removed), which adds noise to every PR.

Dead config invites someone to run `pnpm deploy` and misleads the next reader
about where the app runs.

## Scope

In: delete the files above, drop the scripts/deps/build allowance, regenerate
`pnpm-lock.yaml`, close out stale Cloudflare-era task docs.

Out: `.gitignore` entries for `.open-next/`, `.wrangler`, `.dev.vars*` (the
developer still has a local `.dev.vars`; dropping the ignore could expose it to
`git add`), remote branch cleanup, and anything in the Cloudflare dashboard.

## Tasks

- [x] 1. Remove the Cloudflare/OpenNext files, scripts, deps and `workerd`
      build allowance; regenerate the lockfile.
- [x] 2. Verify in a clean worktree: `pnpm install --frozen-lockfile`, vitest,
      tsc, eslint, `next build`; no Cloudflare references left outside
      history/docs and the `pg` optional dependency.
- [x] 3. Docs: close the stale Cloudflare-era checkboxes in `odd/tasks/` and
      record evidence.
- [ ] 4. User follow-ups: confirm Workers Builds / the Worker are gone in the
      Cloudflare dashboard; confirm the Vercel deploy of this change is green.

## User follow-ups (outside repo)

- Cloudflare dashboard: the zone was deleted during the domain move; confirm
  no Worker or Workers Builds trigger remains for `enoeda`.

## Evidence

- Task 1: `ab48b75` chore(deploy): remove the Cloudflare Workers and OpenNext
  configuration. Deleted `wrangler.jsonc`, `open-next.config.ts`,
  `public/_headers`; dropped 4 scripts, 3 dependencies and the `workerd`
  allowance. Lockfile, compared structurally by parsing both versions as YAML
  (not by reading the textual diff): `pnpm install` reported 177 fewer installed
  packages; the lockfile lost 239 entries in `packages:` (1167 to 928) and 239 in
  `snapshots:` (1169 to 930); **0 entries added**, 0 `packages:` entries changed;
  the only `snapshots:` changes are `optional: true` added to 10 entries
  (`@img/colour`, `@jridgewell/source-map`, `buffer-from`, `commander`,
  `esbuild`, `pg-cloudflare`, `source-map-support`, `supports-color`, `terser`,
  `yaml`), which is pnpm recomputing optionality once the Cloudflare tooling that
  made them required is gone. `importers` lost exactly `pg-cloudflare`,
  `@opennextjs/cloudflare` and `wrangler`. `sharp@0.35.4` dropped out; only
  `0.35.3`, used by Next, remains. The ~85 inserted lines in the textual diff are
  these flags plus unchanged entries the diff re-emitted around removed blocks.
- Task 2, clean linked worktree at `ab48b75`:
  `pnpm install --frozen-lockfile` ok; vitest 701 passed / 1 skipped; tsc clean
  (run after `next build`, which generates `next-env.d.ts`); `next build` ok
  with no env stubs; leftover grep only hits `.gitignore` entries and the
  explanatory comment in `lib/prisma/client.ts`; lockfile has no
  wrangler/miniflare/workerd/opennext.
- eslint exits 1 with 2 errors in `components/theme-toggle.tsx`
  (`react-hooks/set-state-in-effect`) and `lib/domain/students/actions.test.ts`
  (`no-unsafe-function-type`). Both reproduce identically at the parent
  `1e9b489`, so they are pre-existing and not part of this change.
- Function traces: 15 `*.nft.json` files reference `pg-cloudflare` both before
  and after. This change removed the hoisted root `node_modules/pg-cloudflare`
  symlink entries (4 depth variants, 20 to 16 unique strings); the remaining
  `.pnpm/...` entries come from `pg`'s own optional dependency and were already
  present at the baseline whose Vercel deploy is green. The earlier Vercel
  packager failure came from the forced `outputFileTracingIncludes`, removed in
  `8a0265b`.
- Not verifiable locally: Vercel's function packager itself (needs a deploy).

## Lessons

- A lockfile diff that is huge is not necessarily risky, and its inserted lines
  are not necessarily new content: the textual diff re-emits unchanged entries
  next to removed blocks. Parse both lockfiles and compare the key sets and
  values instead of reading the diff (or grepping it), and do not quote the
  package manager's install summary as if it were a lockfile entry count.
- `tsc` in a clean worktree gives false `next/image` errors until `next build`
  has generated `next-env.d.ts`; run it after the build.
