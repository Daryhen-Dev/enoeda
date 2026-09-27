import { createHmac } from "node:crypto";
import { createChallenge, solveChallenge } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import type { Payload } from "altcha-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ALTCHA_HMAC_SECRET = "altcha-test-secret-that-is-at-least-thirty-two-characters";
const REGISTRATION_HASH_SECRET =
  "registration-hash-secret-that-is-at-least-thirty-two-characters";
const KNOWN_COUNTER = 5_000;
const ENVIRONMENT_KEYS = [
  "ALTCHA_CHALLENGE_TTL_SECONDS",
  "ALTCHA_HMAC_SECRET",
  "PUBLIC_REGISTRATION_HASH_SECRET",
] as const;

const originalEnvironment = new Map(
  ENVIRONMENT_KEYS.map((key) => [key, process.env[key]])
);

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  claimPublicRegistrationChallenge,
  verifyPublicRegistrationAltcha,
} from "./security";

async function createPayload(expiresAt: Date): Promise<Payload> {
  const challenge = await createChallenge({
    algorithm: "PBKDF2/SHA-256",
    cost: 5_000,
    counter: KNOWN_COUNTER,
    deriveKey,
    expiresAt,
    hmacSignatureSecret: ALTCHA_HMAC_SECRET,
  });
  const solution = await solveChallenge({
    challenge,
    counterStart: KNOWN_COUNTER,
    deriveKey,
    timeout: 10_000,
  });

  if (!solution) {
    throw new Error("The deterministic ALTCHA test payload could not be solved.");
  }

  return { challenge, solution };
}

function expectedNonceHash(nonce: string): string {
  return createHmac("sha256", REGISTRATION_HASH_SECRET)
    .update(`altcha:${nonce}`)
    .digest("hex");
}

describe("public registration ALTCHA security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALTCHA_CHALLENGE_TTL_SECONDS = "300";
    process.env.ALTCHA_HMAC_SECRET = ALTCHA_HMAC_SECRET;
    process.env.PUBLIC_REGISTRATION_HASH_SECRET = REGISTRATION_HASH_SECRET;
  });

  afterEach(() => {
    for (const key of ENVIRONMENT_KEYS) {
      const value = originalEnvironment.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("accepts a real signed, unexpired ALTCHA payload", async () => {
    const payload = await createPayload(new Date(Date.now() + 60_000));

    const result = await verifyPublicRegistrationAltcha(payload);

    expect(result).toEqual({
      expiresAt: new Date(
        (payload.challenge.parameters.expiresAt ?? 0) * 1_000
      ).toISOString(),
      nonceHash: expectedNonceHash(payload.challenge.parameters.nonce),
    });
  });

  it("rejects a payload whose solved key was altered after solving", async () => {
    const payload = await createPayload(new Date(Date.now() + 60_000));
    const lastCharacter = payload.solution.derivedKey.at(-1);
    const alteredPayload: Payload = {
      ...payload,
      solution: {
        ...payload.solution,
        derivedKey: `${payload.solution.derivedKey.slice(0, -1)}${
          lastCharacter === "0" ? "1" : "0"
        }`,
      },
    };

    await expect(verifyPublicRegistrationAltcha(alteredPayload)).resolves.toBeNull();
  });

  it("rejects an otherwise-valid ALTCHA payload that was signed as expired", async () => {
    const payload = await createPayload(new Date(Date.now() - 60_000));

    await expect(verifyPublicRegistrationAltcha(payload)).resolves.toBeNull();
  });

  it("uses the durable nonce claim as the replay boundary after real verification", async () => {
    const payload = await createPayload(new Date(Date.now() + 60_000));
    const firstVerification = await verifyPublicRegistrationAltcha(payload);
    const secondVerification = await verifyPublicRegistrationAltcha(payload);
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });

    if (!firstVerification || !secondVerification) {
      throw new Error("The deterministic ALTCHA payload should verify before claiming.");
    }

    expect(secondVerification).toEqual(firstVerification);
    await expect(claimPublicRegistrationChallenge(firstVerification)).resolves.toEqual({
      kind: "allowed",
    });
    await expect(claimPublicRegistrationChallenge(secondVerification)).resolves.toEqual({
      kind: "rejected",
    });
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "claim_public_student_registration_altcha_nonce",
      {
        p_expires_at: firstVerification.expiresAt,
        p_nonce_hash: firstVerification.nonceHash,
      }
    );
  });
});
