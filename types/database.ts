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
      academy_modalities: {
        Row: {
          academy_id: string
          created_at: string
          id: string
          name: string
          position: number
          updated_at: string
          uses_belts: boolean
        }
        Insert: {
          academy_id: string
          created_at?: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          uses_belts?: boolean
        }
        Update: {
          academy_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          uses_belts?: boolean
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
      belt_history: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          belt_id: string
          created_at: string
          id: string
          membership_id: string
          modality_id: string
          updated_at: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          belt_id: string
          created_at?: string
          id?: string
          membership_id: string
          modality_id: string
          updated_at?: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          belt_id?: string
          created_at?: string
          id?: string
          membership_id?: string
          modality_id?: string
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
            foreignKeyName: "belt_history_belt_fkey"
            columns: ["belt_id", "modality_id"]
            isOneToOne: false
            referencedRelation: "modality_belts"
            referencedColumns: ["id", "modality_id"]
          },
          {
            foreignKeyName: "belt_history_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "instructor_class_stats"
            referencedColumns: ["membership_id"]
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
          {
            foreignKeyName: "belt_history_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["membership_id"]
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
          modality_id: string | null
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
          modality_id?: string | null
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
          modality_id?: string | null
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
            foreignKeyName: "checkins_modality_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_modality_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["modality_id"]
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
          modality_id: string
          start_time: string
          updated_at: string
          weekday: number
        }
        Insert: {
          academy_id: string
          active?: boolean
          created_at?: string
          id?: string
          modality_id: string
          start_time: string
          updated_at?: string
          weekday: number
        }
        Update: {
          academy_id?: string
          active?: boolean
          created_at?: string
          id?: string
          modality_id?: string
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
          {
            foreignKeyName: "class_schedules_modality_fkey"
            columns: ["modality_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id", "academy_id"]
          },
        ]
      }
      class_sessions: {
        Row: {
          academy_id: string
          class_date: string
          created_at: string
          id: string
          instructor_id: string | null
          modality_id: string | null
          schedule_id: string | null
          updated_at: string
        }
        Insert: {
          academy_id: string
          class_date: string
          created_at?: string
          id?: string
          instructor_id?: string | null
          modality_id?: string | null
          schedule_id?: string | null
          updated_at?: string
        }
        Update: {
          academy_id?: string
          class_date?: string
          created_at?: string
          id?: string
          instructor_id?: string | null
          modality_id?: string | null
          schedule_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_sessions_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["modality_id"]
          },
          {
            foreignKeyName: "class_sessions_schedule_id_academy_id_fkey"
            columns: ["schedule_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id", "academy_id"]
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
          competitor_invited_at: string | null
          competitor_invited_by: string | null
          competitor_since: string | null
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
          competitor_invited_at?: string | null
          competitor_invited_by?: string | null
          competitor_since?: string | null
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
          competitor_invited_at?: string | null
          competitor_invited_by?: string | null
          competitor_since?: string | null
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
            foreignKeyName: "memberships_competitor_invited_by_fkey"
            columns: ["competitor_invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      modality_belts: {
        Row: {
          academy_id: string
          classes_required: number | null
          created_at: string
          id: string
          modality_id: string
          position: number
          primary_color: string
          tip_color: string | null
          updated_at: string
        }
        Insert: {
          academy_id: string
          classes_required?: number | null
          created_at?: string
          id?: string
          modality_id: string
          position: number
          primary_color: string
          tip_color?: string | null
          updated_at?: string
        }
        Update: {
          academy_id?: string
          classes_required?: number | null
          created_at?: string
          id?: string
          modality_id?: string
          position?: number
          primary_color?: string
          tip_color?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modality_belts_modality_id_academy_id_fkey"
            columns: ["modality_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id", "academy_id"]
          },
        ]
      }
      professor_codes: {
        Row: {
          academy_id: string
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          revoked_at: string | null
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          academy_id: string
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          academy_id?: string
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professor_codes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professor_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          birth_date: string | null
          bottle_ml: number | null
          created_at: string
          full_name: string
          height_cm: number | null
          id: string
          sex: string | null
          show_in_ranking: boolean
          timezone: string
          updated_at: string
          weight_kg: number | null
        }
        Insert: {
          avatar_path?: string | null
          birth_date?: string | null
          bottle_ml?: number | null
          created_at?: string
          full_name?: string
          height_cm?: number | null
          id: string
          sex?: string | null
          show_in_ranking?: boolean
          timezone?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Update: {
          avatar_path?: string | null
          birth_date?: string | null
          bottle_ml?: number | null
          created_at?: string
          full_name?: string
          height_cm?: number | null
          id?: string
          sex?: string | null
          show_in_ranking?: boolean
          timezone?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      timer_presets: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          rest_seconds: number
          round_seconds: number
          rounds: number
          updated_at: string
          warning_seconds: number
        }
        Insert: {
          academy_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          rest_seconds: number
          round_seconds: number
          rounds: number
          updated_at?: string
          warning_seconds: number
        }
        Update: {
          academy_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          rest_seconds?: number
          round_seconds?: number
          rounds?: number
          updated_at?: string
          warning_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "timer_presets_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timer_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_goal_days: {
        Row: {
          created_at: string
          day: string
          goal_ml: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          goal_ml: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          goal_ml?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_goal_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      instructor_class_stats: {
        Row: {
          academy_id: string | null
          classes_taught: number | null
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
      membership_class_stats: {
        Row: {
          academy_id: string | null
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
      modality_class_stats: {
        Row: {
          academy_id: string | null
          belt_awarded_at: string | null
          belt_id: string | null
          confirmed_since_belt: number | null
          confirmed_total: number | null
          membership_id: string | null
          modality_id: string | null
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
      academy_ranking: {
        Args: { p_academy_id: string; p_modality_id?: string; p_month: string }
        Returns: {
          avatar_path: string
          classes: number
          full_name: string
          position: number
          user_id: string
        }[]
      }
      academy_ranking_champions: {
        Args: { p_academy_id: string; p_modality_id?: string }
        Returns: {
          avatar_path: string
          classes: number
          full_name: string
          month: string
          user_id: string
        }[]
      }
      academy_today: { Args: { p_academy_id: string }; Returns: string }
      account_deletion_academies: {
        Args: never
        Returns: {
          academy_id: string
        }[]
      }
      copy_diet_day: {
        Args: {
          p_academy_id: string
          p_athlete_id: string
          p_from_date: string
          p_to_date: string
        }
        Returns: number
      }
      create_academy: {
        Args: { p_modalities: string[]; p_name: string }
        Returns: string
      }
      create_professor_code: {
        Args: { p_academy_id: string }
        Returns: {
          code: string
          expires_at: string
          id: string
        }[]
      }
      delete_my_account: { Args: never; Returns: undefined }
      get_profile_details: {
        Args: { p_user_id: string }
        Returns: {
          birth_date: string
          height_cm: number
          sex: string
          weight_kg: number
        }[]
      }
      invite_competitor: {
        Args: { p_membership_id: string }
        Returns: undefined
      }
      join_with_code: {
        Args: { p_code: string }
        Returns: {
          academy_id: string
          is_new: boolean
          membership_id: string
          status: Database["public"]["Enums"]["membership_status"]
        }[]
      }
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
      lookup_invite_code: {
        Args: { p_code: string }
        Returns: {
          academy_name: string
          code_type: Database["public"]["Enums"]["membership_role"]
          logo_path: string
        }[]
      }
      my_water_days: {
        Args: never
        Returns: {
          day: string
          goal_ml: number
          total_ml: number
        }[]
      }
      regenerate_student_code: {
        Args: { p_academy_id: string }
        Returns: string
      }
      remove_competitor: {
        Args: { p_membership_id: string }
        Returns: undefined
      }
      reorder_modality_belts: {
        Args: { p_belt_ids: string[]; p_modality_id: string }
        Returns: undefined
      }
      respond_competitor_invite: {
        Args: { p_accept: boolean; p_membership_id: string }
        Returns: undefined
      }
      save_diet_meal: {
        Args: {
          p_academy_id: string
          p_athlete_id: string
          p_description: string
          p_meal_id: string
          p_meal_time: string
          p_name: string
          p_plan_date: string
        }
        Returns: string
      }
      set_championship_entries: {
        Args: { p_athlete_ids: string[]; p_championship_id: string }
        Returns: undefined
      }
      set_water_plan: {
        Args: {
          p_academy_id: string
          p_athlete_id: string
          p_targets: number[]
        }
        Returns: string
      }
      transfer_ownership: {
        Args: { p_academy_id: string; p_membership_id: string }
        Returns: undefined
      }
    }
    Enums: {
      checkin_status: "pending" | "confirmed" | "rejected"
      membership_role: "owner" | "instructor" | "student"
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
      membership_role: ["owner", "instructor", "student"],
      membership_status: ["pending", "active", "rejected"],
    },
  },
} as const
