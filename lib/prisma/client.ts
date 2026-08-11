/**
 * Server-only marker module.
 *
 * This file exists solely to enforce the server-only boundary for the
 * lib/prisma directory. It does not construct any Prisma runtime, export
 * any helpers, or access any environment variables.
 *
 * The actual RLS executor and Prisma singleton live in
 * lib/auth/server-context.ts, which is the single allowed runtime Prisma
 * consumer in this codebase.
 *
 * NEVER import this module from middleware.ts or any Edge Runtime entrypoint.
 */

import "server-only";
