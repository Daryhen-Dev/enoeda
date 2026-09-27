import { NextResponse } from "next/server";

import {
  claimPublicRegistrationChallenge,
  consumePublicRegistrationRateLimit,
  getPublicRegistrationAltcha,
  publicStudentRegistrationSchema,
  registerPublicStudent,
  verifyPublicRegistrationAltcha,
} from "@/lib/domain/student-registration";

const REGISTRATION_UNAVAILABLE =
  "No se pudo completar el registro. Comuníquese con la administración para continuar.";
const CAPTCHA_FAILURE =
  "No se pudo verificar el desafío de seguridad. Inténtelo nuevamente.";
const RATE_LIMITED =
  "Se alcanzó el límite de intentos. Espere unos minutos antes de volver a intentarlo.";

function response(error: string, status: number): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  let rawInput: Record<string, FormDataEntryValue>;
  let altchaPayload: unknown;

  try {
    const altchaRequest = request.clone();
    rawInput = Object.fromEntries((await request.formData()).entries());
    altchaPayload = await getPublicRegistrationAltcha().getPayloadFromRequest(
      altchaRequest
    );
  } catch {
    return response(REGISTRATION_UNAVAILABLE, 400);
  }

  const { altcha: _altcha, ...registrationInput } = rawInput;
  const parsed = publicStudentRegistrationSchema.safeParse(registrationInput);
  if (!parsed.success) {
    return response(parsed.error.issues[0]?.message ?? REGISTRATION_UNAVAILABLE, 400);
  }

  let verifiedChallenge;
  try {
    verifiedChallenge = await verifyPublicRegistrationAltcha(altchaPayload);
  } catch {
    return response(REGISTRATION_UNAVAILABLE, 503);
  }

  if (verifiedChallenge === null) {
    return response(CAPTCHA_FAILURE, 403);
  }

  let claimedChallenge;
  try {
    claimedChallenge = await claimPublicRegistrationChallenge(verifiedChallenge);
  } catch {
    return response(REGISTRATION_UNAVAILABLE, 503);
  }

  if (claimedChallenge.kind === "unavailable") {
    return response(REGISTRATION_UNAVAILABLE, 503);
  }
  if (claimedChallenge.kind === "rejected") {
    return response(CAPTCHA_FAILURE, 403);
  }

  let rateLimit;
  try {
    rateLimit = await consumePublicRegistrationRateLimit(request, parsed.data.email);
  } catch {
    return response(REGISTRATION_UNAVAILABLE, 503);
  }

  if (rateLimit.kind === "unavailable") {
    return response(REGISTRATION_UNAVAILABLE, 503);
  }
  if (rateLimit.kind === "rejected") {
    return response(RATE_LIMITED, 429);
  }

  try {
    const result = await registerPublicStudent(parsed.data);
    if (!result.success || result.studentId === undefined) {
      return response(REGISTRATION_UNAVAILABLE, 400);
    }

    return NextResponse.json(
      { studentId: result.studentId },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return response(REGISTRATION_UNAVAILABLE, 503);
  }
}
