import "server-only";

import { createHmac } from "node:crypto";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";
import { create, randomInt } from "altcha-lib/frameworks/nextjs";
import type { Payload } from "altcha-lib";

import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_CHALLENGE_TTL_SECONDS = 300;
const DEFAULT_RATE_LIMIT_MAX_ATTEMPTS = 5;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 900;

export interface VerifiedRegistrationChallenge {
  expiresAt: string;
  nonceHash: string;
}

export type SecurityOperationResult =
  | { kind: "allowed" }
  | { kind: "rejected" }
  | { kind: "unavailable" };

function getRequiredSecret(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < 32) {
    throw new Error(`${name} must be configured with at least 32 characters.`);
  }
  return value;
}

function getBoundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }

  return value;
}

function getChallengeTtlSeconds(): number {
  return getBoundedInteger(
    "ALTCHA_CHALLENGE_TTL_SECONDS",
    DEFAULT_CHALLENGE_TTL_SECONDS,
    60,
    900
  );
}

function getRateLimitSettings() {
  return {
    maxAttempts: getBoundedInteger(
      "PUBLIC_REGISTRATION_RATE_LIMIT_MAX_ATTEMPTS",
      DEFAULT_RATE_LIMIT_MAX_ATTEMPTS,
      1,
      100
    ),
    windowSeconds: getBoundedInteger(
      "PUBLIC_REGISTRATION_RATE_LIMIT_WINDOW_SECONDS",
      DEFAULT_RATE_LIMIT_WINDOW_SECONDS,
      60,
      3600
    ),
  };
}

function hashSubject(namespace: string, value: string): string {
  return createHmac("sha256", getRequiredSecret("PUBLIC_REGISTRATION_HASH_SECRET"))
    .update(`${namespace}:${value}`)
    .digest("hex");
}

function isClientPayload(value: unknown): value is Payload {
  return (
    typeof value === "object" &&
    value !== null &&
    "challenge" in value &&
    "solution" in value
  );
}

export function getPublicRegistrationAltcha() {
  const ttlSeconds = getChallengeTtlSeconds();
  return create({
    createChallengeParameters: () => ({
      algorithm: "PBKDF2/SHA-256",
      cost: 5_000,
      counter: randomInt(5_000, 10_000),
      expiresAt: new Date(Date.now() + ttlSeconds * 1_000),
    }),
    deriveKey,
    fieldName: "altcha",
    hmacSignatureSecret: getRequiredSecret("ALTCHA_HMAC_SECRET"),
  });
}

export async function verifyPublicRegistrationAltcha(
  payload: unknown
): Promise<VerifiedRegistrationChallenge | null> {
  const result = await getPublicRegistrationAltcha().verify(
    payload,
    deriveKey,
    getRequiredSecret("ALTCHA_HMAC_SECRET")
  );
  if (
    result.error !== null ||
    result.verification?.verified !== true ||
    !isClientPayload(result.payload)
  ) {
    return null;
  }

  const parameters = result.payload.challenge.parameters;
  const challengeId = parameters.data?.challengeId ?? parameters.nonce;
  const expiresAtSeconds = parameters.expiresAt;
  if (
    typeof challengeId !== "string" ||
    challengeId.length === 0 ||
    typeof expiresAtSeconds !== "number" ||
    !Number.isFinite(expiresAtSeconds)
  ) {
    return null;
  }

  const expiresAt = new Date(expiresAtSeconds * 1_000);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    expiresAt: expiresAt.toISOString(),
    nonceHash: hashSubject("altcha", challengeId),
  };
}

export async function claimPublicRegistrationChallenge(
  challenge: VerifiedRegistrationChallenge
): Promise<SecurityOperationResult> {
  const { data, error } = await createAdminClient().rpc(
    "claim_public_student_registration_altcha_nonce",
    {
      p_expires_at: challenge.expiresAt,
      p_nonce_hash: challenge.nonceHash,
    }
  );

  if (error) return { kind: "unavailable" };
  return data ? { kind: "allowed" } : { kind: "rejected" };
}

function getClientIp(request: Request): string {
  const platformIp = request.headers.get("x-vercel-forwarded-for");
  if (platformIp?.trim()) return platformIp.trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor?.trim()) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return "unknown";
}

export async function consumePublicRegistrationRateLimit(
  request: Request,
  email: string
): Promise<SecurityOperationResult> {
  const settings = getRateLimitSettings();
  const { data, error } = await createAdminClient().rpc(
    "consume_public_student_registration_rate_limit",
    {
      p_email_hash: hashSubject("email", email),
      p_ip_hash: hashSubject("ip", getClientIp(request)),
      p_max_attempts: settings.maxAttempts,
      p_window_seconds: settings.windowSeconds,
    }
  );

  if (error) return { kind: "unavailable" };
  return data ? { kind: "allowed" } : { kind: "rejected" };
}
