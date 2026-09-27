import { NextResponse } from "next/server";

import { getPublicRegistrationAltcha } from "@/lib/domain/student-registration";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    return await getPublicRegistrationAltcha().challengeHandler(request);
  } catch {
    return NextResponse.json(
      { error: "El desafío de seguridad no está disponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
