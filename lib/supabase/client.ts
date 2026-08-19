import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./config";
import type { Database } from "./database.types";

export function createClient() {
  const { url, anonKey } = getSupabasePublicConfig();

  return createBrowserClient<Database>(url, anonKey);
}
