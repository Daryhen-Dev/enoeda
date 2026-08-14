import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Server-only Supabase Auth admin client.
 *
 * Uses the `service_role` secret key, which bypasses RLS entirely and
 * grants access to `auth.admin.*` methods (createUser, updateUserById,
 * etc.). This module MUST NEVER be imported from a Client Component,
 * middleware, or any Edge Runtime entrypoint.
 *
 * Restricted to exactly one purpose in this codebase: the owner creating
 * a branch admin, or a branch admin creating a teacher within their own
 * branch, both via Auth admin `createUser` with a temporary password.
 * Callers MUST verify authorization themselves via the trusted identity
 * resolver / branch-scoped RPC guards BEFORE invoking any admin method —
 * this client performs no authorization of its own.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (server secret, never NEXT_PUBLIC)."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
