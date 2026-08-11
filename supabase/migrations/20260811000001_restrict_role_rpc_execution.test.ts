import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_PATH = path.join(
  __dirname,
  "20260811000001_restrict_role_rpc_execution.sql"
);
const migration = readFileSync(MIGRATION_PATH, "utf-8");

const ROLE_RPC_SIGNATURES = [
  "public.current_roles()",
  "public.grant_role(uuid, public.role_enum)",
  "public.revoke_role(uuid, public.role_enum)",
] as const;

describe("role RPC execution grants", () => {
  it("revokes default anonymous and service-role execution grants", () => {
    for (const signature of ROLE_RPC_SIGNATURES) {
      expect(migration).toMatch(
        new RegExp(`revoke execute on function ${signature.replace(/[().]/g, "\\$&")}[\\s\\S]*?from public, anon, service_role`, "i")
      );
    }
  });

  it("preserves execution for authenticated users", () => {
    for (const signature of ROLE_RPC_SIGNATURES) {
      expect(migration).toContain(
        `grant execute on function ${signature} to authenticated;`
      );
    }
  });
});
