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
          inactive_after_days: number
          logo_path: string | null
          name: string
          plan_tier: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          inactive_after_days?: number
          logo_path?: string | null
          name: string
          plan_tier?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          inactive_after_days?: number
          logo_path?: string | null
          name?: string
          plan_tier?: string | null
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
          {
            foreignKeyName: "academies_plan_tier_fkey"
            columns: ["plan_tier"]
            isOneToOne: false
            referencedRelation: "platform_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      academy_announcements: {
        Row: {
          academy_id: string
          body: string
          created_at: string
          created_by: string | null
          expires_on: string | null
          id: string
          modality_id: string | null
          pinned: boolean
          updated_at: string
        }
        Insert: {
          academy_id: string
          body: string
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          modality_id?: string | null
          pinned?: boolean
          updated_at?: string
        }
        Update: {
          academy_id?: string
          body?: string
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          modality_id?: string | null
          pinned?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_announcements_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_announcements_modality_id_academy_id_fkey"
            columns: ["modality_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id", "academy_id"]
          },
        ]
      }
      academy_event_attendance: {
        Row: {
          academy_id: string
          event_id: string
          marked_at: string
          marked_by: string | null
          user_id: string
        }
        Insert: {
          academy_id: string
          event_id: string
          marked_at?: string
          marked_by?: string | null
          user_id: string
        }
        Update: {
          academy_id?: string
          event_id?: string
          marked_at?: string
          marked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_event_attendance_event_id_academy_id_fkey"
            columns: ["event_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_events"
            referencedColumns: ["id", "academy_id"]
          },
          {
            foreignKeyName: "academy_event_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_event_attendance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_event_modalities: {
        Row: {
          academy_id: string
          event_id: string
          modality_id: string
        }
        Insert: {
          academy_id: string
          event_id: string
          modality_id: string
        }
        Update: {
          academy_id?: string
          event_id?: string
          modality_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_event_modalities_event_id_academy_id_fkey"
            columns: ["event_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_events"
            referencedColumns: ["id", "academy_id"]
          },
          {
            foreignKeyName: "academy_event_modalities_modality_id_academy_id_fkey"
            columns: ["modality_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id", "academy_id"]
          },
        ]
      }
      academy_event_payments: {
        Row: {
          academy_id: string
          event_id: string
          marked_at: string
          marked_by: string | null
          user_id: string
        }
        Insert: {
          academy_id: string
          event_id: string
          marked_at?: string
          marked_by?: string | null
          user_id: string
        }
        Update: {
          academy_id?: string
          event_id?: string
          marked_at?: string
          marked_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_event_payments_event_id_academy_id_fkey"
            columns: ["event_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_events"
            referencedColumns: ["id", "academy_id"]
          },
          {
            foreignKeyName: "academy_event_payments_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_event_payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_event_rsvps: {
        Row: {
          academy_id: string
          event_id: string
          responded_at: string
          status: Database["public"]["Enums"]["academy_event_rsvp_status"]
          user_id: string
        }
        Insert: {
          academy_id: string
          event_id: string
          responded_at?: string
          status: Database["public"]["Enums"]["academy_event_rsvp_status"]
          user_id: string
        }
        Update: {
          academy_id?: string
          event_id?: string
          responded_at?: string
          status?: Database["public"]["Enums"]["academy_event_rsvp_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_event_rsvps_event_id_academy_id_fkey"
            columns: ["event_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_events"
            referencedColumns: ["id", "academy_id"]
          },
          {
            foreignKeyName: "academy_event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_events: {
        Row: {
          academy_id: string
          all_modalities: boolean
          cancelled_at: string | null
          cancelled_by: string | null
          capacity: number | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_time: string | null
          event_date: string
          id: string
          location: string | null
          price_cents: number | null
          rsvp_deadline: string | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          all_modalities?: boolean
          cancelled_at?: string | null
          cancelled_by?: string | null
          capacity?: number | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          id?: string
          location?: string | null
          price_cents?: number | null
          rsvp_deadline?: string | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          all_modalities?: boolean
          cancelled_at?: string | null
          cancelled_by?: string | null
          capacity?: number | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          id?: string
          location?: string | null
          price_cents?: number | null
          rsvp_deadline?: string | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_events_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_events_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_finance_settings: {
        Row: {
          academy_id: string
          block_overdue: boolean
          default_due_day: number
          enabled: boolean
          updated_at: string
        }
        Insert: {
          academy_id: string
          block_overdue?: boolean
          default_due_day?: number
          enabled?: boolean
          updated_at?: string
        }
        Update: {
          academy_id?: string
          block_overdue?: boolean
          default_due_day?: number
          enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_finance_settings_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: true
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_invite_codes: {
        Row: {
          academy_id: string
          code: string
          code_type: Database["public"]["Enums"]["membership_role"]
          created_at: string
          created_by: string | null
          id: string
          replaced_at: string | null
          status: string
        }
        Insert: {
          academy_id: string
          code: string
          code_type: Database["public"]["Enums"]["membership_role"]
          created_at?: string
          created_by?: string | null
          id?: string
          replaced_at?: string | null
          status?: string
        }
        Update: {
          academy_id?: string
          code?: string
          code_type?: Database["public"]["Enums"]["membership_role"]
          created_at?: string
          created_by?: string | null
          id?: string
          replaced_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_invite_codes_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_invite_codes_created_by_fkey"
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
      athlete_previous_records: {
        Row: {
          academy_id: string
          athlete_id: string
          bronze: number
          created_at: string
          draws: number
          gold: number
          id: string
          losses: number
          modality_id: string
          silver: number
          updated_at: string
          wins: number
        }
        Insert: {
          academy_id: string
          athlete_id: string
          bronze?: number
          created_at?: string
          draws?: number
          gold?: number
          id?: string
          losses?: number
          modality_id: string
          silver?: number
          updated_at?: string
          wins?: number
        }
        Update: {
          academy_id?: string
          athlete_id?: string
          bronze?: number
          created_at?: string
          draws?: number
          gold?: number
          id?: string
          losses?: number
          modality_id?: string
          silver?: number
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_previous_records_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_previous_records_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_previous_records_modality_id_academy_id_fkey"
            columns: ["modality_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id", "academy_id"]
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
          placement: string | null
          updated_at: string
        }
        Insert: {
          academy_id: string
          athlete_id: string
          championship_id: string
          created_at?: string
          id?: string
          placement?: string | null
          updated_at?: string
        }
        Update: {
          academy_id?: string
          athlete_id?: string
          championship_id?: string
          created_at?: string
          id?: string
          placement?: string | null
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
      championship_fights: {
        Row: {
          academy_id: string
          athlete_id: string
          created_at: string
          entry_id: string
          id: string
          method: string
          note: string | null
          opponent_name: string | null
          recorded_by: string | null
          result: string
          stage: string | null
          updated_at: string
        }
        Insert: {
          academy_id: string
          athlete_id: string
          created_at?: string
          entry_id: string
          id?: string
          method: string
          note?: string | null
          opponent_name?: string | null
          recorded_by?: string | null
          result: string
          stage?: string | null
          updated_at?: string
        }
        Update: {
          academy_id?: string
          athlete_id?: string
          created_at?: string
          entry_id?: string
          id?: string
          method?: string
          note?: string | null
          opponent_name?: string | null
          recorded_by?: string | null
          result?: string
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "championship_fights_entry_id_academy_id_athlete_id_fkey"
            columns: ["entry_id", "academy_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "championship_entries"
            referencedColumns: ["id", "academy_id", "athlete_id"]
          },
          {
            foreignKeyName: "championship_fights_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      championships: {
        Row: {
          academy_id: string
          counts_in_record: boolean
          created_at: string
          event_date: string
          historical_athlete_id: string | null
          id: string
          is_historical: boolean
          location: string
          modality_id: string
          name: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          counts_in_record?: boolean
          created_at?: string
          event_date: string
          historical_athlete_id?: string | null
          id?: string
          is_historical?: boolean
          location?: string
          modality_id: string
          name: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          counts_in_record?: boolean
          created_at?: string
          event_date?: string
          historical_athlete_id?: string | null
          id?: string
          is_historical?: boolean
          location?: string
          modality_id?: string
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
          {
            foreignKeyName: "championships_historical_athlete_id_fkey"
            columns: ["historical_athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "championships_modality_fkey"
            columns: ["modality_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id", "academy_id"]
          },
        ]
      }
      checkins: {
        Row: {
          academy_id: string
          class_date: string
          created_at: string
          id: string
          marked_by: string | null
          modality_id: string | null
          occurrence_schedule_id: string | null
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
          marked_by?: string | null
          modality_id?: string | null
          occurrence_schedule_id?: string | null
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
          marked_by?: string | null
          modality_id?: string | null
          occurrence_schedule_id?: string | null
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
            foreignKeyName: "checkins_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      class_attendance_exceptions: {
        Row: {
          academy_id: string
          class_date: string
          id: string
          membership_id: string | null
          occurrence_schedule_id: string
          reason: string
          schedule_id: string | null
        }
        Insert: {
          academy_id: string
          class_date: string
          id?: string
          membership_id?: string | null
          occurrence_schedule_id: string
          reason: string
          schedule_id?: string | null
        }
        Update: {
          academy_id?: string
          class_date?: string
          id?: string
          membership_id?: string | null
          occurrence_schedule_id?: string
          reason?: string
          schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_attendance_exceptions_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_exceptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "instructor_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "class_attendance_exceptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "class_attendance_exceptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_attendance_exceptions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "class_attendance_exceptions_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
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
          instructor_id: string | null
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
          instructor_id?: string | null
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
          instructor_id?: string | null
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
            foreignKeyName: "class_schedules_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      discipline_streaks: {
        Row: {
          academy_id: string
          current_weeks: number
          freezes: number
          record_weeks: number
          updated_at: string
          user_id: string
          week_done: boolean
          week_start: string
        }
        Insert: {
          academy_id: string
          current_weeks?: number
          freezes?: number
          record_weeks?: number
          updated_at?: string
          user_id: string
          week_done?: boolean
          week_start: string
        }
        Update: {
          academy_id?: string
          current_weeks?: number
          freezes?: number
          record_weeks?: number
          updated_at?: string
          user_id?: string
          week_done?: boolean
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_streaks_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discipline_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discipline_weeks: {
        Row: {
          academy_id: string
          confirmed_classes: number
          state: string
          user_id: string
          water_days: number
          week_start: string
        }
        Insert: {
          academy_id: string
          confirmed_classes: number
          state: string
          user_id: string
          water_days: number
          week_start: string
        }
        Update: {
          academy_id?: string
          confirmed_classes?: number
          state?: string
          user_id?: string
          water_days?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "discipline_weeks_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discipline_weeks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_charges: {
        Row: {
          academy_id: string
          amount_cents: number
          created_at: string
          due_date: string
          id: string
          paid_amount_cents: number | null
          paid_marked_at: string | null
          paid_marked_by: string | null
          paid_on: string | null
          payment_method:
            | Database["public"]["Enums"]["finance_payment_method"]
            | null
          reference_month: string
          student_name: string
          user_id: string | null
        }
        Insert: {
          academy_id: string
          amount_cents: number
          created_at?: string
          due_date: string
          id?: string
          paid_amount_cents?: number | null
          paid_marked_at?: string | null
          paid_marked_by?: string | null
          paid_on?: string | null
          payment_method?:
            | Database["public"]["Enums"]["finance_payment_method"]
            | null
          reference_month: string
          student_name: string
          user_id?: string | null
        }
        Update: {
          academy_id?: string
          amount_cents?: number
          created_at?: string
          due_date?: string
          id?: string
          paid_amount_cents?: number | null
          paid_marked_at?: string | null
          paid_marked_by?: string | null
          paid_on?: string | null
          payment_method?:
            | Database["public"]["Enums"]["finance_payment_method"]
            | null
          reference_month?: string
          student_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_charges_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_charges_paid_marked_by_fkey"
            columns: ["paid_marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_charges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_expenses: {
        Row: {
          academy_id: string
          amount_cents: number
          category: Database["public"]["Enums"]["finance_expense_category"]
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          repeats_monthly: boolean
          series_id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          amount_cents: number
          category: Database["public"]["Enums"]["finance_expense_category"]
          created_at?: string
          created_by?: string | null
          description: string
          expense_date: string
          id?: string
          repeats_monthly?: boolean
          series_id?: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          amount_cents?: number
          category?: Database["public"]["Enums"]["finance_expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          repeats_monthly?: boolean
          series_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_expenses_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_plans: {
        Row: {
          academy_id: string
          amount_cents: number
          archived_at: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          academy_id: string
          amount_cents: number
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          academy_id?: string
          amount_cents?: number
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_plans_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_student_billing: {
        Row: {
          academy_id: string
          custom_amount_cents: number | null
          due_day: number | null
          is_exempt: boolean
          membership_id: string
          plan_id: string | null
          updated_at: string
        }
        Insert: {
          academy_id: string
          custom_amount_cents?: number | null
          due_day?: number | null
          is_exempt?: boolean
          membership_id: string
          plan_id?: string | null
          updated_at?: string
        }
        Update: {
          academy_id?: string
          custom_amount_cents?: number | null
          due_day?: number | null
          is_exempt?: boolean
          membership_id?: string
          plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_student_billing_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_student_billing_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: true
            referencedRelation: "instructor_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "finance_student_billing_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: true
            referencedRelation: "membership_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "finance_student_billing_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: true
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_student_billing_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: true
            referencedRelation: "modality_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "finance_student_billing_plan_id_academy_id_fkey"
            columns: ["plan_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "finance_plans"
            referencedColumns: ["id", "academy_id"]
          },
        ]
      }
      instructor_belts: {
        Row: {
          academy_id: string
          belt_id: string
          created_at: string
          membership_id: string
          modality_id: string
          updated_at: string
        }
        Insert: {
          academy_id: string
          belt_id: string
          created_at?: string
          membership_id: string
          modality_id: string
          updated_at?: string
        }
        Update: {
          academy_id?: string
          belt_id?: string
          created_at?: string
          membership_id?: string
          modality_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_belts_belt_id_modality_id_fkey"
            columns: ["belt_id", "modality_id"]
            isOneToOne: false
            referencedRelation: "modality_belts"
            referencedColumns: ["id", "modality_id"]
          },
          {
            foreignKeyName: "instructor_belts_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "instructor_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "instructor_belts_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "instructor_belts_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_belts_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "instructor_belts_modality_id_academy_id_fkey"
            columns: ["modality_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id", "academy_id"]
          },
        ]
      }
      instructor_modalities: {
        Row: {
          academy_id: string
          created_at: string
          membership_id: string
          modality_id: string
        }
        Insert: {
          academy_id: string
          created_at?: string
          membership_id: string
          modality_id: string
        }
        Update: {
          academy_id?: string
          created_at?: string
          membership_id?: string
          modality_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instructor_modalities_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "instructor_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "instructor_modalities_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "instructor_modalities_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instructor_modalities_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "instructor_modalities_modality_id_academy_id_fkey"
            columns: ["modality_id", "academy_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id", "academy_id"]
          },
        ]
      }
      instructor_profiles: {
        Row: {
          bio: string | null
          created_at: string
          instagram: string | null
          show_contacts_to_students: boolean
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          instagram?: string | null
          show_contacts_to_students?: boolean
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          instagram?: string | null
          show_contacts_to_students?: boolean
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      personal_timer_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          rest_seconds: number
          round_seconds: number
          rounds: number
          updated_at: string
          user_id: string
          warning_seconds: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rest_seconds: number
          round_seconds: number
          rounds: number
          updated_at?: string
          user_id?: string
          warning_seconds: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rest_seconds?: number
          round_seconds?: number
          rounds?: number
          updated_at?: string
          user_id?: string
          warning_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_timer_presets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcement_dismissals: {
        Row: {
          announcement_id: string
          dismissed_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_announcement_dismissals_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "platform_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_announcement_dismissals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string | null
          ends_on: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          audience: string
          body: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string | null
          ends_on?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_plans: {
        Row: {
          annual_discount_pct: number
          benefits: string[]
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_popular: boolean
          monthly_price_cents: number
          name: string
          position: number
          student_limit: number | null
          trial_days: number
          updated_at: string
        }
        Insert: {
          annual_discount_pct?: number
          benefits?: string[]
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_popular?: boolean
          monthly_price_cents: number
          name: string
          position?: number
          student_limit?: number | null
          trial_days?: number
          updated_at?: string
        }
        Update: {
          annual_discount_pct?: number
          benefits?: string[]
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_popular?: boolean
          monthly_price_cents?: number
          name?: string
          position?: number
          student_limit?: number | null
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          birth_date: string | null
          bottle_ml: number | null
          created_at: string
          full_name: string
          height_cm: number | null
          hidden_timer_presets: string[]
          id: string
          personal_water_goal_ml: number | null
          reach_cm: number | null
          sex: string | null
          show_in_ranking: boolean
          timer_preset_order: string[]
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
          hidden_timer_presets?: string[]
          id: string
          personal_water_goal_ml?: number | null
          reach_cm?: number | null
          sex?: string | null
          show_in_ranking?: boolean
          timer_preset_order?: string[]
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
          hidden_timer_presets?: string[]
          id?: string
          personal_water_goal_ml?: number | null
          reach_cm?: number | null
          sex?: string | null
          show_in_ranking?: boolean
          timer_preset_order?: string[]
          timezone?: string
          updated_at?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      ranking_details: {
        Row: {
          academy_id: string
          attendance_rate: number
          confirmed_classes: number
          days_to_qualify: number
          eligible_days: number
          eligible_hydration_days: number
          hydration_goals_achieved: number
          hydration_rate: number
          modality_id: string
          protected_days: number
          scheduled_classes: number
          user_id: string
          weeks: number
        }
        Insert: {
          academy_id: string
          attendance_rate: number
          confirmed_classes: number
          days_to_qualify: number
          eligible_days: number
          eligible_hydration_days: number
          hydration_goals_achieved: number
          hydration_rate: number
          modality_id: string
          protected_days: number
          scheduled_classes?: number
          user_id: string
          weeks: number
        }
        Update: {
          academy_id?: string
          attendance_rate?: number
          confirmed_classes?: number
          days_to_qualify?: number
          eligible_days?: number
          eligible_hydration_days?: number
          hydration_goals_achieved?: number
          hydration_rate?: number
          modality_id?: string
          protected_days?: number
          scheduled_classes?: number
          user_id?: string
          weeks?: number
        }
        Relationships: [
          {
            foreignKeyName: "ranking_details_academy_id_modality_id_user_id_fkey"
            columns: ["academy_id", "modality_id", "user_id"]
            isOneToOne: true
            referencedRelation: "ranking_snapshots"
            referencedColumns: ["academy_id", "modality_id", "user_id"]
          },
        ]
      }
      ranking_position_history: {
        Row: {
          academy_id: string
          modality_id: string
          period_to: string
          position: number
          user_id: string
        }
        Insert: {
          academy_id: string
          modality_id: string
          period_to: string
          position: number
          user_id: string
        }
        Update: {
          academy_id?: string
          modality_id?: string
          period_to?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_position_history_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_position_history_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_position_history_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["modality_id"]
          },
          {
            foreignKeyName: "ranking_position_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_snapshots: {
        Row: {
          academy_id: string
          avatar_path: string | null
          days_to_qualify: number
          full_name: string
          modality_id: string
          period_from: string
          period_to: string
          position: number | null
          score: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academy_id: string
          avatar_path?: string | null
          days_to_qualify?: number
          full_name: string
          modality_id: string
          period_from: string
          period_to: string
          position?: number | null
          score: number
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academy_id?: string
          avatar_path?: string | null
          days_to_qualify?: number
          full_name?: string
          modality_id?: string
          period_from?: string
          period_to?: string
          position?: number | null
          score?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_snapshots_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_snapshots_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_snapshots_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["modality_id"]
          },
          {
            foreignKeyName: "ranking_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_class_enrollments: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          membership_id: string
          modality_id: string | null
          occurrence_schedule_id: string
          schedule_id: string | null
          start_time: string
          starts_on: string
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          membership_id: string
          modality_id?: string | null
          occurrence_schedule_id: string
          schedule_id?: string | null
          start_time: string
          starts_on: string
          weekday: number
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          membership_id?: string
          modality_id?: string | null
          occurrence_schedule_id?: string
          schedule_id?: string | null
          start_time?: string
          starts_on?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_class_enrollments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "instructor_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "student_class_enrollments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "student_class_enrollments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_enrollments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "student_class_enrollments_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_class_enrollments_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["modality_id"]
          },
          {
            foreignKeyName: "student_class_enrollments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "class_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      student_modality_enrollments: {
        Row: {
          competitor_invited_at: string | null
          competitor_invited_by: string | null
          competitor_since: string | null
          created_at: string
          id: string
          is_competitor: boolean
          membership_id: string
          modality_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          competitor_invited_at?: string | null
          competitor_invited_by?: string | null
          competitor_since?: string | null
          created_at?: string
          id?: string
          is_competitor?: boolean
          membership_id: string
          modality_id: string
          started_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          competitor_invited_at?: string | null
          competitor_invited_by?: string | null
          competitor_since?: string | null
          created_at?: string
          id?: string
          is_competitor?: boolean
          membership_id?: string
          modality_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_modality_enrollments_competitor_invited_by_fkey"
            columns: ["competitor_invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_modality_enrollments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "instructor_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "student_modality_enrollments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "membership_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "student_modality_enrollments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_modality_enrollments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["membership_id"]
          },
          {
            foreignKeyName: "student_modality_enrollments_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_modality_enrollments_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["modality_id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_staff: boolean
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          academy_id: string | null
          closed_at: string | null
          created_at: string
          id: string
          last_message_at: string
          number: number
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          academy_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          number?: never
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          academy_id?: string | null
          closed_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          number?: never
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timer_presets: {
        Row: {
          academy_id: string
          created_at: string
          created_by: string | null
          id: string
          modality_id: string | null
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
          modality_id?: string | null
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
          modality_id?: string | null
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
          {
            foreignKeyName: "timer_presets_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "academy_modalities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timer_presets_modality_id_fkey"
            columns: ["modality_id"]
            isOneToOne: false
            referencedRelation: "modality_class_stats"
            referencedColumns: ["modality_id"]
          },
        ]
      }
      tv_displays: {
        Row: {
          academy_id: string | null
          display_user_id: string
          id: string
          last_seen_at: string | null
          name: string
          paired_at: string | null
          paired_by: string | null
          pairing_code: string | null
          pairing_expires_at: string | null
          state_version: number
          timer_state: Json | null
          updated_at: string
        }
        Insert: {
          academy_id?: string | null
          display_user_id: string
          id?: string
          last_seen_at?: string | null
          name?: string
          paired_at?: string | null
          paired_by?: string | null
          pairing_code?: string | null
          pairing_expires_at?: string | null
          state_version?: number
          timer_state?: Json | null
          updated_at?: string
        }
        Update: {
          academy_id?: string | null
          display_user_id?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          paired_at?: string | null
          paired_by?: string | null
          pairing_code?: string | null
          pairing_expires_at?: string | null
          state_version?: number
          timer_state?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tv_displays_academy_id_fkey"
            columns: ["academy_id"]
            isOneToOne: false
            referencedRelation: "academies"
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
          is_limit: boolean
          plan_id: string
          target_ml: number
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_limit?: boolean
          plan_id: string
          target_ml: number
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          id?: string
          is_limit?: boolean
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
      academy_announcements_feed: {
        Args: { p_academy_id: string }
        Returns: {
          academy_id: string
          author_avatar_path: string
          author_name: string
          body: string
          created_at: string
          created_by: string
          expires_on: string
          id: string
          modality_id: string
          pinned: boolean
          updated_at: string
        }[]
      }
      academy_event_people: {
        Args: { p_event_id: string }
        Returns: {
          attended: boolean
          avatar_path: string
          belt_primary: string
          belt_tip: string
          full_name: string
          paid: boolean
          responded_at: string
          role: Database["public"]["Enums"]["membership_role"]
          status: Database["public"]["Enums"]["academy_event_rsvp_status"]
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
      admin_academy_modalities: {
        Args: { p_academy_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      admin_add_customer_note: {
        Args: { p_academy_id: string; p_body: string; p_kind: string }
        Returns: string
      }
      admin_create_invoice: {
        Args: {
          p_academy_id: string
          p_amount_cents: number
          p_description: string
          p_due_date: string
          p_reference_month: string
        }
        Returns: string
      }
      admin_dashboard: { Args: never; Returns: Json }
      admin_decide_membership: {
        Args: {
          p_approve: boolean
          p_membership_id: string
          p_modality_ids?: string[]
        }
        Returns: undefined
      }
      admin_delete_customer_note: {
        Args: { p_note_id: string }
        Returns: undefined
      }
      admin_delete_platform_announcement: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_generate_invoices: {
        Args: { p_due_day?: number; p_month: string }
        Returns: number
      }
      admin_get_academy: {
        Args: { p_academy_id: string }
        Returns: {
          created_at: string
          id: string
          inactive_after_days: number
          logo_path: string
          name: string
          owner_email: string
          owner_id: string
          owner_name: string
          plan_tier: string
          timezone: string
        }[]
      }
      admin_get_customer: { Args: { p_academy_id: string }; Returns: Json }
      admin_get_ticket: { Args: { p_ticket_id: string }; Returns: Json }
      admin_get_user: { Args: { p_user_id: string }; Returns: Json }
      admin_is_admin: { Args: never; Returns: boolean }
      admin_list_academies: {
        Args: { p_search?: string }
        Returns: {
          created_at: string
          id: string
          logo_path: string
          name: string
          owner_email: string
          owner_id: string
          owner_name: string
          pending: number
          plan_tier: string
          staff: number
          students: number
        }[]
      }
      admin_list_customers: {
        Args: { p_search?: string }
        Returns: {
          academy_id: string
          billing_period: string
          created_at: string
          last_note_at: string
          logo_path: string
          mrr_cents: number
          name: string
          open_tickets: number
          overdue_cents: number
          owner_email: string
          owner_id: string
          owner_name: string
          owner_whatsapp: string
          plan_code: string
          plan_name: string
          status: string
          students: number
          trial_ends_at: string
        }[]
      }
      admin_list_invoices: {
        Args: { p_from?: string; p_status?: string; p_to?: string }
        Returns: {
          academy_id: string
          academy_name: string
          amount_cents: number
          created_at: string
          description: string
          due_date: string
          id: string
          is_overdue: boolean
          number: number
          paid_on: string
          payment_method: string
          provider: string
          reference_month: string
          status: string
        }[]
      }
      admin_list_members: {
        Args: { p_academy_id: string }
        Returns: {
          created_at: string
          decided_at: string
          email: string
          full_name: string
          is_competitor: boolean
          membership_id: string
          modalities: Json
          role: Database["public"]["Enums"]["membership_role"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }[]
      }
      admin_list_plans: {
        Args: never
        Returns: {
          academies: number
          annual_discount_pct: number
          benefits: string[]
          code: string
          id: string
          is_active: boolean
          is_popular: boolean
          monthly_price_cents: number
          name: string
          sort_position: number
          student_limit: number
          trial_days: number
        }[]
      }
      admin_list_platform_announcements: {
        Args: never
        Returns: {
          audience: string
          body: string
          created_at: string
          dismissals: number
          ends_on: string
          id: string
          is_live: boolean
          title: string
          updated_at: string
        }[]
      }
      admin_list_tickets: {
        Args: { p_search?: string; p_status?: string }
        Returns: {
          academy_id: string
          academy_name: string
          created_at: string
          id: string
          last_message_at: string
          messages: number
          number: number
          priority: string
          status: string
          subject: string
          user_email: string
          user_id: string
          user_name: string
        }[]
      }
      admin_list_users: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string }
        Returns: {
          academies: number
          created_at: string
          email: string
          full_name: string
          id: string
          last_sign_in_at: string
          total_count: number
        }[]
      }
      admin_overview: {
        Args: never
        Returns: {
          academies: number
          active_staff: number
          active_students: number
          pending_requests: number
          users: number
        }[]
      }
      admin_remove_membership: {
        Args: { p_membership_id: string }
        Returns: undefined
      }
      admin_reply_ticket: {
        Args: { p_body: string; p_close?: boolean; p_ticket_id: string }
        Returns: undefined
      }
      admin_report: { Args: { p_months?: number }; Returns: Json }
      admin_save_plan: {
        Args: {
          p_annual_discount_pct: number
          p_benefits: string[]
          p_code: string
          p_id: string
          p_is_active: boolean
          p_is_popular: boolean
          p_monthly_price_cents: number
          p_name: string
          p_position: number
          p_student_limit: number
          p_trial_days: number
        }
        Returns: string
      }
      admin_save_platform_announcement: {
        Args: {
          p_audience: string
          p_body: string
          p_ends_on: string
          p_id: string
          p_title: string
        }
        Returns: string
      }
      admin_set_competitor: {
        Args: { p_enrollment_id: string; p_is_competitor: boolean }
        Returns: undefined
      }
      admin_set_invoice_status: {
        Args: {
          p_invoice_id: string
          p_paid_on?: string
          p_payment_method?: string
          p_status: string
        }
        Returns: undefined
      }
      admin_set_member_role: {
        Args: {
          p_membership_id: string
          p_modality_ids?: string[]
          p_role: Database["public"]["Enums"]["membership_role"]
        }
        Returns: undefined
      }
      admin_set_student_modalities: {
        Args: { p_membership_id: string; p_modality_ids: string[] }
        Returns: undefined
      }
      admin_set_ticket: {
        Args: { p_priority: string; p_status: string; p_ticket_id: string }
        Returns: undefined
      }
      admin_update_academy: {
        Args: {
          p_academy_id: string
          p_inactive_after_days: number
          p_name: string
        }
        Returns: undefined
      }
      admin_update_profile: {
        Args: {
          p_birth_date: string
          p_full_name: string
          p_height_cm: number
          p_reach_cm: number
          p_sex: string
          p_user_id: string
          p_weight_kg: number
        }
        Returns: undefined
      }
      admin_update_subscription: {
        Args: {
          p_academy_id: string
          p_billing_period: string
          p_custom_price_cents: number
          p_plan_code: string
          p_status: string
          p_trial_ends_at: string
        }
        Returns: undefined
      }
      approve_student: {
        Args: { p_membership_id: string; p_modality_ids: string[] }
        Returns: undefined
      }
      athlete_fight_history: {
        Args: { p_academy_id: string; p_athlete_id: string }
        Returns: {
          championship_id: string
          counts_in_record: boolean
          entry_id: string
          event_date: string
          fights: Json
          is_historical: boolean
          location: string
          modality_id: string
          name: string
          placement: string
        }[]
      }
      championship_competitors: {
        Args: { p_championship_id: string }
        Returns: {
          avatar_path: string
          belt_primary: string
          belt_tip: string
          draws: number
          full_name: string
          losses: number
          placement: string
          user_id: string
          wins: number
        }[]
      }
      class_attendees: {
        Args: { p_class_date: string; p_schedule_id: string }
        Returns: {
          avatar_path: string
          belt_primary: string
          belt_tip: string
          full_name: string
          status: Database["public"]["Enums"]["checkin_status"]
          user_id: string
        }[]
      }
      class_report: {
        Args: { p_academy_id: string; p_user_id: string }
        Returns: Json
      }
      classmates: {
        Args: { p_academy_id: string }
        Returns: {
          avatar_path: string
          full_name: string
          member_since: string
          modalities: Json
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }[]
      }
      close_support_ticket: {
        Args: { p_ticket_id: string }
        Returns: undefined
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
      create_academy_with_setup: {
        Args: { p_modalities: Json; p_name: string; p_plan_tier: string }
        Returns: string
      }
      create_previous_championship: {
        Args: {
          p_academy_id: string
          p_athlete_id: string
          p_event_date: string
          p_location: string
          p_modality_id: string
          p_name: string
        }
        Returns: string
      }
      create_support_ticket: {
        Args: { p_academy_id?: string; p_body: string; p_subject: string }
        Returns: string
      }
      create_tv_pairing: {
        Args: never
        Returns: {
          academy_id: string | null
          display_user_id: string
          id: string
          last_seen_at: string | null
          name: string
          paired_at: string | null
          paired_by: string | null
          pairing_code: string | null
          pairing_expires_at: string | null
          state_version: number
          timer_state: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tv_displays"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_my_account: { Args: never; Returns: undefined }
      dismiss_platform_announcement: {
        Args: { p_announcement_id: string }
        Returns: undefined
      }
      fight_record_summary: {
        Args: { p_academy_id: string; p_athlete_id: string }
        Returns: {
          bronze: number
          championships: number
          draws: number
          gold: number
          losses: number
          modality_id: string
          silver: number
          wins: number
        }[]
      }
      finance_open_charges: {
        Args: { p_academy_id: string }
        Returns: {
          amount_cents: number
          avatar_path: string
          due_date: string
          full_name: string
          id: string
          membership_id: string
          overdue: boolean
          reference_month: string
          user_id: string
        }[]
      }
      finance_report: {
        Args: { p_academy_id: string; p_month: string }
        Returns: Json
      }
      get_instructor_profile: {
        Args: { p_academy_id: string; p_user_id: string }
        Returns: {
          avatar_path: string
          belts: Json
          bio: string
          competitors_count: number
          full_name: string
          graduations_count: number
          instagram: string
          member_since: string
          membership_id: string
          modality_ids: string[]
          role: Database["public"]["Enums"]["membership_role"]
          schedules: Json
          show_contacts_to_students: boolean
          user_id: string
          whatsapp: string
        }[]
      }
      get_profile_details: {
        Args: { p_user_id: string }
        Returns: {
          birth_date: string
          height_cm: number
          reach_cm: number
          sex: string
          weight_kg: number
        }[]
      }
      inactive_students: {
        Args: { p_academy_id: string }
        Returns: {
          inactive_since: string
          joined_on: string
          last_class_date: string
          membership_id: string
          user_id: string
        }[]
      }
      invite_competitor: {
        Args: { p_membership_id: string; p_modality_id: string }
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
          avatar_path: string
          email: string
          full_name: string
          membership_id: string
          requested_at: string
          role: Database["public"]["Enums"]["membership_role"]
          user_id: string
        }[]
      }
      list_public_plans: {
        Args: never
        Returns: {
          annual_discount_pct: number
          benefits: string[]
          code: string
          is_popular: boolean
          monthly_price_cents: number
          name: string
          student_limit: number
          trial_days: number
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
      my_discipline: { Args: { p_academy_id: string }; Returns: Json }
      my_finance_status: {
        Args: { p_academy_id: string }
        Returns: {
          blocked: boolean
          overdue_months: string[]
        }[]
      }
      my_water_days: {
        Args: never
        Returns: {
          day: string
          goal_ml: number
          is_limit: boolean
          total_ml: number
        }[]
      }
      pair_tv: {
        Args: { p_academy_id: string; p_code: string; p_name: string }
        Returns: {
          academy_id: string | null
          display_user_id: string
          id: string
          last_seen_at: string | null
          name: string
          paired_at: string | null
          paired_by: string | null
          pairing_code: string | null
          pairing_expires_at: string | null
          state_version: number
          timer_state: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tv_displays"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      platform_announcements_feed: {
        Args: never
        Returns: {
          audience: string
          body: string
          created_at: string
          ends_on: string
          id: string
          title: string
        }[]
      }
      ranking_modalities: {
        Args: { p_academy_id: string; p_from: string; p_to: string }
        Returns: {
          modality_id: string
          name: string
          position: number
        }[]
      }
      recalculate_ranking: {
        Args: { p_academy_id: string }
        Returns: undefined
      }
      record_my_water_goal: { Args: never; Returns: undefined }
      regenerate_invite_code: {
        Args: {
          p_academy_id: string
          p_code_type: Database["public"]["Enums"]["membership_role"]
        }
        Returns: string
      }
      remove_competitor: {
        Args: { p_membership_id: string; p_modality_id: string }
        Returns: undefined
      }
      reorder_modality_belts: {
        Args: { p_belt_ids: string[]; p_modality_id: string }
        Returns: undefined
      }
      reply_support_ticket: {
        Args: { p_body: string; p_ticket_id: string }
        Returns: undefined
      }
      respond_competitor_invite: {
        Args: {
          p_accept: boolean
          p_membership_id: string
          p_modality_id: string
        }
        Returns: undefined
      }
      save_academy_event: {
        Args: {
          p_academy_id: string
          p_capacity: number
          p_cover_path: string
          p_description: string
          p_end_time: string
          p_event_date: string
          p_event_id: string
          p_location: string
          p_modality_ids: string[]
          p_price_cents: number
          p_rsvp_deadline: string
          p_start_time: string
          p_title: string
        }
        Returns: string
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
      server_now: { Args: never; Returns: string }
      set_championship_entries: {
        Args: { p_athlete_ids: string[]; p_championship_id: string }
        Returns: undefined
      }
      set_instructor_belt: {
        Args: {
          p_belt_id: string
          p_membership_id: string
          p_modality_id: string
        }
        Returns: undefined
      }
      set_instructor_modalities: {
        Args: { p_membership_id: string; p_modality_ids: string[] }
        Returns: undefined
      }
      set_previous_record: {
        Args: {
          p_academy_id: string
          p_athlete_id: string
          p_bronze: number
          p_draws: number
          p_gold: number
          p_losses: number
          p_modality_id: string
          p_silver: number
          p_wins: number
        }
        Returns: undefined
      }
      set_student_class_enrollment: {
        Args: {
          p_enrolled: boolean
          p_membership_id: string
          p_schedule_id: string
        }
        Returns: undefined
      }
      set_student_modalities: {
        Args: { p_membership_id: string; p_modality_ids: string[] }
        Returns: undefined
      }
      set_water_plan: {
        Args: {
          p_academy_id: string
          p_athlete_id: string
          p_limits?: boolean[]
          p_targets: number[]
        }
        Returns: string
      }
      transfer_ownership: {
        Args: { p_academy_id: string; p_membership_id: string }
        Returns: undefined
      }
      tv_academy_brand: {
        Args: never
        Returns: {
          logo_path: string
          name: string
        }[]
      }
      tv_disconnect_self: { Args: never; Returns: undefined }
      tv_heartbeat: { Args: never; Returns: undefined }
      unpair_tv: { Args: { p_display_id: string }; Returns: undefined }
      update_tv_timer: {
        Args: {
          p_display_id: string
          p_expected_version: number
          p_state: Json
        }
        Returns: {
          academy_id: string | null
          display_user_id: string
          id: string
          last_seen_at: string | null
          name: string
          paired_at: string | null
          paired_by: string | null
          pairing_code: string | null
          pairing_expires_at: string | null
          state_version: number
          timer_state: Json | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tv_displays"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      academy_event_rsvp_status: "going" | "not_going"
      checkin_status: "pending" | "confirmed" | "rejected"
      finance_expense_category:
        | "rent"
        | "water"
        | "energy"
        | "internet"
        | "equipment"
        | "salaries"
        | "maintenance"
        | "taxes"
        | "other"
      finance_payment_method: "pix" | "cash" | "card" | "transfer" | "other"
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
      academy_event_rsvp_status: ["going", "not_going"],
      checkin_status: ["pending", "confirmed", "rejected"],
      finance_expense_category: [
        "rent",
        "water",
        "energy",
        "internet",
        "equipment",
        "salaries",
        "maintenance",
        "taxes",
        "other",
      ],
      finance_payment_method: ["pix", "cash", "card", "transfer", "other"],
      membership_role: ["owner", "instructor", "student"],
      membership_status: ["pending", "active", "rejected"],
    },
  },
} as const
