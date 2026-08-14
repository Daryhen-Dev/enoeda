"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { CHANGE_PASSWORD_MESSAGES, COMMON_MESSAGES } from "@/lib/localization/es-ec";

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const changePasswordSchema = z
  .object({
    newPassword: z.string().min(8, { error: CHANGE_PASSWORD_MESSAGES.MIN_LENGTH_ERROR }),
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    error: CHANGE_PASSWORD_MESSAGES.MISMATCH_ERROR,
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Sets a new password for the currently authenticated user and clears the
 * `must_change_password` flag. Identity is derived server-side from the
 * cookie-backed session — no caller-supplied user id is ever accepted.
 *
 * Uses the regular (anon-key) server client via `updateUser`, which is
 * scoped to the caller's own account; this does NOT require the
 * service_role admin client.
 */
export async function changeOwnPassword(
  input: ChangePasswordInput
): Promise<ActionResult<{ updated: true }>> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: COMMON_MESSAGES.AUTHENTICATION_REQUIRED };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (updateError) {
    return { success: false, error: CHANGE_PASSWORD_MESSAGES.FAILURE };
  }

  // Clear the forced-change flag. app_metadata can only be modified via
  // the admin API, but updateUser cannot touch it — this call targets the
  // caller's OWN id only, resolved server-side above, never client input.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error: metadataError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { must_change_password: false },
  });

  if (metadataError) {
    return { success: false, error: CHANGE_PASSWORD_MESSAGES.FAILURE };
  }

  return { success: true, data: { updated: true } };
}
