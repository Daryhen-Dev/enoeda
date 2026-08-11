/**
 * Generated from the configured Supabase project after the U2 migrations.
 * Regenerate with the Supabase MCP type generator after approved schema changes.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      user_roles: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          role: Database["public"]["Enums"]["role_enum"];
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role: Database["public"]["Enums"]["role_enum"];
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role?: Database["public"]["Enums"]["role_enum"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_roles: {
        Args: never;
        Returns: Database["public"]["Enums"]["role_enum"][];
      };
      grant_role: {
        Args: {
          p_role: Database["public"]["Enums"]["role_enum"];
          p_target_user_id: string;
        };
        Returns: string;
      };
      revoke_role: {
        Args: {
          p_role: Database["public"]["Enums"]["role_enum"];
          p_target_user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      role_enum: "admin" | "teacher";
    };
    CompositeTypes: Record<string, never>;
  };
};
