export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invite_code: string
          logo_path: string | null
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string
          logo_path?: string | null
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string
          logo_path?: string | null
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_invites: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["membership_role"]
          token: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["membership_role"]
          token?: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_invites_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_modalities: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_modalities_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      belt_goals: {
        Row: {
          academy_id: string
          belt: string
          classes_required: number
          created_at: string
          id: string
          position: number
          updated_at: string
        }
        Insert: {
          academy_id: string
          belt: string
          classes_required: number
          created_at?: string
          id?: string
          position: number
          updated_at?: string
        }
        Update: {
          academy_id?: string
          belt?: string
          classes_required?: number
          created_at?: string
          id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "belt_goals_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      belt_history: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          belt: string
          created_at: string
          id: string
          membership_id: string
          updated_at: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          belt: string
          created_at?: string
          id?: string
          membership_id: string
          updated_at?: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          belt?: string
          created_at?: string
          id?: string
          membership_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "belt_history_awarded_by_fkey"
            columns: ["awarded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "belt_history_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "belt_history_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      championship_entries: {
        Row: {
          academy_id: string
          athlete_id: string
          championship_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          athlete_id: string
          championship_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          athlete_id?: string
          championship_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "championship_entries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championship_entries_championship_id_academy_id_fkey"
            columns: ["championship_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "championships"
            referencedColumns: ["id", "academy_id"]
          },
        ]
      }
      championships: {
        Row: {
          academy_id: string
          created_at: string
          event_date: string
          id: string
          location: string
          name: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          event_date: string
          id?: string
          location?: string
          name: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          event_date?: string
          id?: string
          location?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "championships_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          academy_id: string
          class_date: string
          created_at: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          schedule_id: string | null
          status: Database["public"]["Enums"]["checkin_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          academy_id: string
          class_date: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["checkin_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          academy_id?: string
          class_date?: string
          created_at?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          schedule_id?: string | null
          status?: Database["public"]["Enums"]["checkin_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_schedule_id_academy_id_fkey"
            columns: ["schedule_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id", "academy_id"]
          },
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedules: {
        Row: {
          academy_id: string
          active: boolean
          created_at: string
          id: string
          modality: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          academy_id: string
          active?: boolean
          created_at?: string
          id?: string
          modality: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          academy_id?: string
          active?: boolean
          created_at?: string
          id?: string
          modality?: string
          start_time?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_plan_meals: {
        Row: {
          created_at: string
          description: string
          id: string
          meal_time: string | null
          name: string
          plan_id: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          meal_time?: string | null
          name: string
          plan_id: string
          position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          meal_time?: string | null
          name?: string
          plan_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_plan_meals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_plans: {
        Row: {
          academy_id: string
          athlete_id: string
          created_at: string
          id: string
          plan_date: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          athlete_id: string
          created_at?: string
          id?: string
          plan_date: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          athlete_id?: string
          created_at?: string
          id?: string
          plan_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_plans_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_plans_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          academy_id: string
          belt: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          is_competitor: boolean
          role: Database["public"]["Enums"]["membership_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          academy_id: string
          belt?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          is_competitor?: boolean
          role: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          academy_id?: string
          belt?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          is_competitor?: boolean
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bottle_ml: number | null
          created_at: string
          full_name: string
          height_cm: number | null
          id: string
          timezone: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          bottle_ml?: number | null
          created_at?: string
          full_name?: string
          height_cm?: number | null
          id: string
          timezone?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          bottle_ml?: number | null
          created_at?: string
          full_name?: string
          height_cm?: number | null
          id?: string
          timezone?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      water_logs: {
        Row: {
          amount_ml: number
          created_at: string
          id: string
          logged_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_ml: number
          created_at?: string
          id: string
          logged_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          id?: string
          logged_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_plan_days: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          target_ml: number
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          target_ml: number
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          target_ml?: number
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "water_plan_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "water_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      water_plans: {
        Row: {
          academy_id: string
          athlete_id: string
          created_at: string
          id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          academy_id: string
          athlete_id: string
          created_at?: string
          id?: string
          updated_at?: string
          week_start: string
        }
        Update: {
          academy_id?: string
          athlete_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_plans_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_plans_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_logs: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          logged_on: string
          updated_at: string
          weight_kg: number
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          logged_on: string
          updated_at?: string
          weight_kg: number
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          logged_on?: string
          updated_at?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_logs_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      membership_class_stats: {
        Row: {
          academy_id: string | null
          belt: string | null
          belt_awarded_at: string | null
          confirmed_since_belt: number | null
          confirmed_total: number | null
          membership_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      academy_today: { Args: { p_academy_id: string }; Returns: string }
      create_academy: {
        Args: { p_modalities: string[]; p_name: string }
        Returns: string
      }
      get_academy_preview_by_code: {
        Args: { p_invite_code: string }
        Returns: {
          academy_name: string
          logo_path: string
        }[]
      }
      get_invite_preview: {
        Args: { p_token: string }
        Returns: {
          academy_name: string
          logo_path: string
          role: Database["public"]["Enums"]["membership_role"]
        }[]
      }
      join_academy: { Args: { p_invite_code: string }; Returns: string }
      list_pending_requests: {
        Args: { p_academy_id: string }
        Returns: {
          email: string
          full_name: string
          membership_id: string
          requested_at: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }[]
      }
      reorder_belt_goals: {
        Args: { p_academy_id: string; p_goal_ids: string[] }
        Returns: undefined
      }
      request_membership: { Args: { p_token: string }; Returns: string }
      rotate_invite: {
        Args: {
          p_academy_id: string
          p_role: Database["public"]["Enums"]["membership_role"]
        }
        Returns: string
      }
    }
    Enums: {
      checkin_status: "pending" | "confirmed" | "rejected"
      membership_role: "professor" | "student"
      membership_status: "pending" | "active" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      checkin_status: ["pending", "confirmed", "rejected"],
      membership_role: ["professor", "student"],
      membership_status: ["pending", "active", "rejected"],
    },
  },
} as const
