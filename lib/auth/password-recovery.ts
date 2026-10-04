"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { RECOVERY_CALLBACK_NEXT } from "@/lib/auth/redirect";
import { AUTH_MESSAGES } from "@/lib/localization/es-ec";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const recoveryEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: AUTH_MESSAGES.INVALID_EMAIL })),
});

export type RecoveryEmailInput = z.infer<typeof recoveryEmailSchema>;

/**
 * Builds the deployment origin from request headers so the recovery link
 * redirects back to whichever domain served the request.
 */
async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    throw new Error("Missing host header.");
  }
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/**
 * Sends a Supabase password-recovery email for admins and teachers.
 *
 * Identity verification is delegated to Supabase: the response is
 * enumeration-neutral, so a valid request always reports success whether or
 * not the email exists. No caller-supplied user id is ever accepted.
 */
export async function requestPasswordRecovery(
  input: unknown
): Promise<ActionResult<{ sent: true }>> {
  const parsed = recoveryEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: AUTH_MESSAGES.INVALID_EMAIL };
  }

  const supabase = await createClient();

  try {
    const origin = await getRequestOrigin();
    const redirectTo = new URL("/auth/callback", origin);
    redirectTo.searchParams.set("next", RECOVERY_CALLBACK_NEXT);

    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: redirectTo.toString() }
    );

    if (error) {
      console.error("[auth] resetPasswordForEmail failed", {
        name: error.name,
        message: error.message,
      });
    }
  } catch (error) {
    console.error("[auth] password recovery request failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  // Enumeration-neutral by design; failures are only logged server-side.
  return { success: true, data: { sent: true } };
}
