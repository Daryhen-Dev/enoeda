/**
 * Generated from the configured Supabase project after the branches_students migration.
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
      branches: {
        Row: {
          address: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          phone: string | null;
          time_zone: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          phone?: string | null;
          time_zone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          phone?: string | null;
          time_zone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          branch_id: string;
          created_at: string;
          date_of_birth: string;
          email: string;
          first_name: string;
          id: string;
          is_active: boolean;
          national_id: string;
          surname: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          date_of_birth: string;
          email: string;
          first_name: string;
          id?: string;
          is_active?: boolean;
          national_id: string;
          surname: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          date_of_birth?: string;
          email?: string;
          first_name?: string;
          id?: string;
          is_active?: boolean;
          national_id?: string;
          surname?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
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
