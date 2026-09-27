/**
 * Generated from the configured Supabase project after the current migration set.
 * Regenerate with the Supabase type generator after approved schema changes.
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
          activation_status: string;
          auth_user_id: string | null;
          branch_id: string;
          created_at: string;
          date_of_birth: string;
          email: string;
          first_name: string;
          id: string;
          is_active: boolean;
          national_id: string;
          phone: string | null;
          surname: string;
          updated_at: string;
        };
        Insert: {
          activation_status?: string;
          auth_user_id?: string | null;
          branch_id: string;
          created_at?: string;
          date_of_birth: string;
          email: string;
          first_name: string;
          id?: string;
          is_active?: boolean;
          national_id: string;
          phone?: string | null;
          surname: string;
          updated_at?: string;
        };
        Update: {
          activation_status?: string;
          auth_user_id?: string | null;
          branch_id?: string;
          created_at?: string;
          date_of_birth?: string;
          email?: string;
          first_name?: string;
          id?: string;
          is_active?: boolean;
          national_id?: string;
          phone?: string | null;
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
      user_profiles: {
        Row: {
          created_at: string;
          date_of_birth: string;
          first_name: string;
          phone: string | null;
          surname: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date_of_birth: string;
          first_name: string;
          phone?: string | null;
          surname: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date_of_birth?: string;
          first_name?: string;
          phone?: string | null;
          surname?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          branch_id: string | null;
          id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          role: Database["public"]["Enums"]["role_enum"];
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          branch_id?: string | null;
          id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role: Database["public"]["Enums"]["role_enum"];
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          branch_id?: string | null;
          id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          role?: Database["public"]["Enums"]["role_enum"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      assign_branch_admin: {
        Args: {
          p_target: string;
          p_branch_id: string;
        };
        Returns: string;
      };
      assign_branch_teacher: {
        Args: {
          p_target: string;
          p_branch_id: string;
        };
        Returns: string;
      };
      claim_public_student_registration_altcha_nonce: {
        Args: {
          p_expires_at: string;
          p_nonce_hash: string;
        };
        Returns: boolean;
      };
      consume_public_student_registration_rate_limit: {
        Args: {
          p_email_hash: string;
          p_ip_hash: string;
          p_max_attempts: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      current_roles: {
        Args: never;
        Returns: {
          role: Database["public"]["Enums"]["role_enum"];
          branch_id: string | null;
        }[];
      };
      ensure_own_user_profile: {
        Args: {
          p_date_of_birth: string;
          p_first_name: string;
          p_phone: string;
          p_surname: string;
        };
        Returns: Database["public"]["Tables"]["user_profiles"]["Row"];
      };
      revoke_branch_role: {
        Args: {
          p_target: string;
          p_role: Database["public"]["Enums"]["role_enum"];
          p_branch_id: string;
        };
        Returns: boolean;
      };
      revoke_teacher_with_reassignment: {
        Args: {
          p_target_user_id: string;
          p_branch_id: string;
        };
        Returns: Json;
      };
      set_branch_default_teacher: {
        Args: {
          p_branch_id: string;
          p_teacher_id: string;
        };
        Returns: undefined;
      };
      update_own_student_phone: {
        Args: {
          p_phone: string | null;
        };
        Returns: string;
      };
    };
    Enums: {
      role_enum: "admin" | "owner" | "teacher";
    };
    CompositeTypes: Record<string, never>;
  };
};
