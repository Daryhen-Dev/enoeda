import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_ROLES = ["teacher"] as const;

interface RlsContextRow {
  currentUser: string;
  authUid: string | null;
  jwtClaims: string | null;
}

function isClaimsObject(
  value: unknown
): value is { sub: unknown; roles: unknown } {
  return typeof value === "object" && value !== null && "sub" in value && "roles" in value;
}

const runtimeIt = process.env.DATABASE_URL ? it : it.skip;

describe("withUser runtime RLS context", () => {
  runtimeIt("sets the authenticated role and JWT claims for its transaction", async () => {
    const { withUser } = await import("./client");

    const [context] = await withUser(
      { userId: TEST_USER_ID, roles: TEST_ROLES },
      (tx) =>
        tx.$queryRaw<RlsContextRow[]>`
          SELECT
            current_user AS "currentUser",
            auth.uid()::text AS "authUid",
            current_setting('request.jwt.claims', true) AS "jwtClaims"
        `
    );

    expect(context).toBeDefined();
    expect(context.currentUser).toBe("authenticated");
    expect(context.authUid).toBe(TEST_USER_ID);

    expect(context.jwtClaims).not.toBeNull();
    const claims: unknown = JSON.parse(context.jwtClaims ?? "");

    expect(isClaimsObject(claims)).toBe(true);
    if (!isClaimsObject(claims)) {
      throw new Error("request.jwt.claims must be a JSON object with sub and roles.");
    }

    expect(claims.sub).toBe(TEST_USER_ID);
    expect(Array.isArray(claims.roles)).toBe(true);
    expect(claims.roles).toEqual(TEST_ROLES);
  });
});
