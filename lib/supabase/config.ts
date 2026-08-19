export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

function isConfigured(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missingVariables = [
    !isConfigured(url) && "NEXT_PUBLIC_SUPABASE_URL",
    !isConfigured(anonKey) && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter((variable): variable is string => Boolean(variable));

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required Supabase public environment variables: ${missingVariables.join(
        ", "
      )}. Configure them and restart the application.`
    );
  }

  return { url, anonKey };
}
