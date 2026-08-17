"use server";

import { getAuthenticatedContext, withAuthenticatedUser } from "@/lib/auth/server-context";
import { COMMON_MESSAGES } from "@/lib/localization/es-ec";
import { createClient } from "@/lib/supabase/server";
import { ownProfileSchema, type OwnProfileInput } from "./schema";

export interface ProfileActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface OwnProfile {
  first_name: string;
  surname: string;
  phone: string | null;
  date_of_birth: string;
}

function hasOperatingProfileRole(roles: readonly string[]): boolean {
  return roles.includes("admin") || roles.includes("teacher");
}

function toOwnProfile(profile: {
  first_name: string;
  surname: string;
  phone: string | null;
  date_of_birth: Date | string;
}): OwnProfile {
  return {
    first_name: profile.first_name,
    surname: profile.surname,
    phone: profile.phone,
    date_of_birth:
      typeof profile.date_of_birth === "string"
        ? profile.date_of_birth
        : profile.date_of_birth.toISOString().slice(0, 10),
  };
}

export async function getOwnProfile(): Promise<ProfileActionResult<OwnProfile | null>> {
  const result = await withAuthenticatedUser(async (tx, ctx) => {
    if (!hasOperatingProfileRole(ctx.roles)) {
      return { profile: null, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }

    const profile = await tx.user_profiles.findUnique({
      where: { user_id: ctx.userId },
      select: {
        first_name: true,
        surname: true,
        phone: true,
        date_of_birth: true,
      },
    });

    return { profile, error: null };
  });

  if (!result.success) return result;
  if (result.data.error !== null) {
    return { success: false, error: result.data.error };
  }

  return {
    success: true,
    data:
      result.data.profile === null ? null : toOwnProfile(result.data.profile),
  };
}

export async function updateOwnProfile(
  input: OwnProfileInput
): Promise<ProfileActionResult<OwnProfile>> {
  const parsed = ownProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const result = await withAuthenticatedUser(async (tx, ctx) => {
    if (!hasOperatingProfileRole(ctx.roles)) {
      return { profile: null, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }

    const profile = await tx.user_profiles.update({
      where: { user_id: ctx.userId },
      data: {
        first_name: parsed.data.first_name,
        surname: parsed.data.surname,
        phone: parsed.data.phone ?? null,
        date_of_birth: new Date(parsed.data.date_of_birth),
      },
      select: {
        first_name: true,
        surname: true,
        phone: true,
        date_of_birth: true,
      },
    });

    return { profile, error: null };
  });

  if (!result.success) return result;
  if (result.data.error !== null || result.data.profile === null) {
    return {
      success: false,
      error: result.data.error ?? COMMON_MESSAGES.UNEXPECTED_ERROR,
    };
  }

  return { success: true, data: toOwnProfile(result.data.profile) };
}

export async function ensureOwnProfile(
  input: OwnProfileInput
): Promise<ProfileActionResult<OwnProfile>> {
  const parsed = ownProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const identity = await getAuthenticatedContext();
  if (!identity.ok) {
    return {
      success: false,
      error:
        identity.reason === "unauthenticated"
          ? COMMON_MESSAGES.AUTHENTICATION_REQUIRED
          : COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS,
    };
  }
  if (!hasOperatingProfileRole(identity.ctx.roles)) {
    return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_own_user_profile", {
    p_first_name: parsed.data.first_name,
    p_surname: parsed.data.surname,
    p_phone: parsed.data.phone ?? "",
    p_date_of_birth: parsed.data.date_of_birth,
  });

  if (error || data === null) {
    if (error?.message.includes("unauthorized")) {
      return { success: false, error: COMMON_MESSAGES.INSUFFICIENT_PERMISSIONS };
    }
    return { success: false, error: COMMON_MESSAGES.UNEXPECTED_ERROR };
  }

  return { success: true, data: toOwnProfile(data) };
}
