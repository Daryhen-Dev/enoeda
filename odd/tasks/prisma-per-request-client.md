# Prisma per-request client on Cloudflare Workers

## Problem

Production Worker logs (Workers observability, 2026-09-28..10-01) show the only
application error across `/owner`, `/owner/branches`, `/dashboard/profile`:

```
PrismaClientKnownRequestError P2028
Transaction API error: Unable to start a transaction in the given time.
```

Owner sees branches intermittently: sometimes the overview lists them, the
branches page fails, and going back shows an empty list.

## Root cause

`lib/prisma/client.ts` caches one `PrismaClient` (with its `PrismaPg` pool) on
`globalThis`. Workers reuse the isolate across requests, but TCP sockets are
bound to the request that opened them, so later requests inherit an unusable
pool and `$transaction` times out waiting for a connection.

Secondary: owner pages issue two `listBranches` transactions (active + inactive)
and silently render a partial/empty list when only one fails.

## Tasks

- [ ] 1. `lib/prisma/client.ts`: create a `PrismaClient` + `PrismaPg` per
      `withUser` call and `$disconnect()` it in `finally`; unit test it.
- [ ] 2. Owner pages: fetch all branches in one `listBranches({ status: "all" })`
      call and show the load-failure alert whenever it fails.
- [ ] 3. Deploy and confirm P2028 disappears from Workers logs (user-owned push).

## Evidence

(commits recorded per task)
