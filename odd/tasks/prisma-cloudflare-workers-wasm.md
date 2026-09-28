# Prisma on Cloudflare Workers (Wasm query compiler)

## Problem

Deployed Worker fails every Prisma read and write. UI shows a generic
"unexpected error"; Cloudflare recorded nothing until PR #179 added logging.

Real error, from Workers observability (commit `7b4b0c9`):

```
CompileError: WebAssembly.Module(): Wasm code generation disallowed by embedder
    at Object.getQueryCompilerWasmModule
    at Object.loadQueryCompiler
    at jt.transaction
```

## Root cause

Prisma's default generated client (`prisma-client` provider, Node target) emits:

```ts
async function decodeBase64AsWasm(b64: string): Promise<WebAssembly.Module> {
  const { Buffer } = await import("node:buffer")
  return new WebAssembly.Module(Buffer.from(b64, "base64"))   // runtime compile
}
```

workerd forbids compiling Wasm at runtime (it would defeat request snapshotting),
so every query dies before a socket is ever opened. The database was never the
problem: a direct `pg` probe from Node connected fine on both TLS and non-TLS.

Wrong hypothesis worth recording: `pg-cloudflare` / Supabase pooler 6543 was
blamed first. It was not involved — the failure happens earlier, in the query
compiler.

## Fix

Generate the client for the `workerd` runtime target (official Prisma target):

```prisma
generator client {
  provider = "prisma-client"
  output   = "../lib/prisma/generated"
  runtime  = "workerd"
}
```

which swaps the loader for a bundler-precompiled module:

```ts
getQueryCompilerWasmModule: async () => {
  const { default: module } = await import("./query_compiler_fast_bg.wasm?module")
  return module
}
```

`prisma generate` then emits `internal/query_compiler_fast_bg.js` (6.4 KB) and
`internal/query_compiler_fast_bg.wasm` (3.67 MB).

## Evidence so far

- [x] `prisma validate` accepts `runtime = "workerd"` (a string; the array form is rejected)
- [x] `pnpm test` — 683 passed, 1 skipped, no regressions
- [x] `pnpm build` (`next build`, Turbopack) resolves `.wasm?module` and completes
- [ ] OpenNext/esbuild (`.open-next` bundle) resolves `.wasm?module` — must verify in Linux container, `opennextjs-cloudflare build` cannot run on Windows
- [ ] Deployed Worker performs a read and a write

## Open decision

How `query_compiler_fast_bg.wasm` reaches the build:

- commit the 3.67 MB binary next to the already-tracked generated client, or
- `"prepare": "prisma generate"` + gitignore it (Cloudflare Workers Builds runs
  `pnpm install`, which fires the project's own `prepare`)

Note: the repo already tracks `lib/prisma/generated/**`, and the CI build command
is `npx opennextjs-cloudflare build`, which does not run `db:generate`.

## Blast radius / risks

- `runtime` is a single value: deviating from `nodejs` also changes what local
  Node tooling imports (`@prisma/client/runtime/wasm-compiler-edge`). Tests pass
  because they mock Prisma; `next dev` behaviour needs a manual check.
- 3.67 MB added to the Worker bundle. Cloudflare Wasm module bindings are not
  counted the same way as script bytes, but the deploy must confirm it fits.
- Upstream: prisma/orm#28657 (open, unconfirmed) documents the base64 path
  failing on Workers.

## Related

- PR #179 `7b4b0c9` — logs the real error (this is what made the cause visible)
