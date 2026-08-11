/**
 * Placeholder for Supabase-generated database types.
 * Regenerate with: supabase gen types typescript --project-id <ref> > lib/supabase/database.types.ts
 * or via MCP get_types_typescript after migrations are applied.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
