import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

import { getSafeEnrollmentCallbackRedirect } from "@/lib/auth/redirect";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

function callbackFailureResponse(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "auth_callback");
  return NextResponse.redirect(loginUrl);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return callbackFailureResponse(request);
  }

  const destination = getSafeEnrollmentCallbackRedirect(
    request.nextUrl.searchParams.get("next")
  );
  const response = NextResponse.redirect(new URL(destination, request.url));
  const { anonKey, url } = getSupabasePublicConfig();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, options, value } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? callbackFailureResponse(request) : response;
}
