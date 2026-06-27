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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_suspensions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          lifted_at: string | null
          reason: string
          starts_at: string
          suspended_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          lifted_at?: string | null
          reason: string
          starts_at?: string
          suspended_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          lifted_at?: string | null
          reason?: string
          starts_at?: string
          suspended_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_availability: {
        Row: {
          changed_at: string
          note: string | null
          status: Database["public"]["Enums"]["agent_presence"]
          user_id: string
        }
        Insert: {
          changed_at?: string
          note?: string | null
          status?: Database["public"]["Enums"]["agent_presence"]
          user_id: string
        }
        Update: {
          changed_at?: string
          note?: string | null
          status?: Database["public"]["Enums"]["agent_presence"]
          user_id?: string
        }
        Relationships: []
      }
      agent_availability_log: {
        Row: {
          at: string
          id: string
          note: string | null
          status: Database["public"]["Enums"]["agent_presence"]
          user_id: string
        }
        Insert: {
          at?: string
          id?: string
          note?: string | null
          status: Database["public"]["Enums"]["agent_presence"]
          user_id: string
        }
        Update: {
          at?: string
          id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["agent_presence"]
          user_id?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          diff: Json | null
          id: number
          ip: unknown
          organization_id: string | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          diff?: Json | null
          id?: number
          ip?: unknown
          organization_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          diff?: Json | null
          id?: number
          ip?: unknown
          organization_id?: string | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_monitoring_sessions: {
        Row: {
          call_id: string
          ended_at: string | null
          id: string
          kind: Database["public"]["Enums"]["monitor_kind"]
          notes: string | null
          started_at: string
          supervisor_id: string
        }
        Insert: {
          call_id: string
          ended_at?: string | null
          id?: string
          kind: Database["public"]["Enums"]["monitor_kind"]
          notes?: string | null
          started_at?: string
          supervisor_id: string
        }
        Update: {
          call_id?: string
          ended_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["monitor_kind"]
          notes?: string | null
          started_at?: string
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_monitoring_sessions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_queue: {
        Row: {
          assigned_agent_id: string | null
          call_id: string | null
          contact_id: string | null
          estimated_wait_seconds: number | null
          from_number: string | null
          id: string
          organization_id: string | null
          picked_at: string | null
          priority: number
          queued_at: string
          status: string
          team_id: string | null
          to_number: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          call_id?: string | null
          contact_id?: string | null
          estimated_wait_seconds?: number | null
          from_number?: string | null
          id?: string
          organization_id?: string | null
          picked_at?: string | null
          priority?: number
          queued_at?: string
          status?: string
          team_id?: string | null
          to_number?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          call_id?: string | null
          contact_id?: string | null
          estimated_wait_seconds?: number | null
          from_number?: string | null
          id?: string
          organization_id?: string | null
          picked_at?: string | null
          priority?: number
          queued_at?: string
          status?: string
          team_id?: string | null
          to_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_queue_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_queue_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      call_recording_access_log: {
        Row: {
          accessed_at: string
          call_id: string
          id: number
          ip: unknown
          reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          call_id: string
          id?: number
          ip?: unknown
          reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          call_id?: string
          id?: number
          ip?: unknown
          reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_recording_access_log_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_review_tags: {
        Row: {
          call_id: string
          created_at: string
          created_by: string
          id: string
          marked_for: string | null
          note: string | null
          tag: string
        }
        Insert: {
          call_id: string
          created_at?: string
          created_by: string
          id?: string
          marked_for?: string | null
          note?: string | null
          tag: string
        }
        Update: {
          call_id?: string
          created_at?: string
          created_by?: string
          id?: string
          marked_for?: string | null
          note?: string | null
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_review_tags_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_transfers: {
        Row: {
          call_id: string
          completed_at: string | null
          created_at: string
          from_agent_id: string | null
          id: string
          kind: Database["public"]["Enums"]["transfer_kind"]
          reason: string | null
          to_agent_id: string | null
          to_team_id: string | null
        }
        Insert: {
          call_id: string
          completed_at?: string | null
          created_at?: string
          from_agent_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["transfer_kind"]
          reason?: string | null
          to_agent_id?: string | null
          to_team_id?: string | null
        }
        Update: {
          call_id?: string
          completed_at?: string | null
          created_at?: string
          from_agent_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["transfer_kind"]
          reason?: string | null
          to_agent_id?: string | null
          to_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_transfers_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      caller_ids: {
        Row: {
          active: boolean
          created_at: string
          e164_number: string
          id: string
          is_default: boolean
          label: string
          organization_id: string | null
          team_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          e164_number: string
          id?: string
          is_default?: boolean
          label: string
          organization_id?: string | null
          team_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          e164_number?: string
          id?: string
          is_default?: boolean
          label?: string
          organization_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "caller_ids_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caller_ids_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          agent_id: string
          answered_at: string | null
          audio_path: string | null
          caller_id_used: string | null
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          direction: string
          duration_seconds: number
          ended_at: string | null
          failure_reason: string | null
          follow_up_date: string | null
          from_number: string | null
          id: string
          notes: string | null
          organization_id: string | null
          outcome: string
          provider: string | null
          provider_call_sid: string | null
          quality_score: number | null
          recording_duration_seconds: number | null
          recording_masked_ranges: Json
          recording_path: string | null
          recording_sensitive: boolean
          retry_count: number
          started_at: string
          status: Database["public"]["Enums"]["call_status"]
          supervisor_comments: string | null
          team_id: string | null
          to_number: string | null
          updated_at: string
          voicemail_detected: boolean
          voicemail_dropped: boolean
        }
        Insert: {
          agent_id: string
          answered_at?: string | null
          audio_path?: string | null
          caller_id_used?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number
          ended_at?: string | null
          failure_reason?: string | null
          follow_up_date?: string | null
          from_number?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          outcome?: string
          provider?: string | null
          provider_call_sid?: string | null
          quality_score?: number | null
          recording_duration_seconds?: number | null
          recording_masked_ranges?: Json
          recording_path?: string | null
          recording_sensitive?: boolean
          retry_count?: number
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          supervisor_comments?: string | null
          team_id?: string | null
          to_number?: string | null
          updated_at?: string
          voicemail_detected?: boolean
          voicemail_dropped?: boolean
        }
        Update: {
          agent_id?: string
          answered_at?: string | null
          audio_path?: string | null
          caller_id_used?: string | null
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          direction?: string
          duration_seconds?: number
          ended_at?: string | null
          failure_reason?: string | null
          follow_up_date?: string | null
          from_number?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          outcome?: string
          provider?: string | null
          provider_call_sid?: string | null
          quality_score?: number | null
          recording_duration_seconds?: number | null
          recording_masked_ranges?: Json
          recording_path?: string | null
          recording_sensitive?: boolean
          retry_count?: number
          started_at?: string
          status?: Database["public"]["Enums"]["call_status"]
          supervisor_comments?: string | null
          team_id?: string | null
          to_number?: string | null
          updated_at?: string
          voicemail_detected?: boolean
          voicemail_dropped?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calls_caller_id_used_fkey"
            columns: ["caller_id_used"]
            isOneToOne: false
            referencedRelation: "caller_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          dial_mode: string
          id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          dial_mode?: string
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          dial_mode?: string
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_change_approvals: {
        Row: {
          client_id: string
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          reason: string | null
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: Database["public"]["Enums"]["client_change_state"]
        }
        Insert: {
          client_id: string
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: Database["public"]["Enums"]["client_change_state"]
        }
        Update: {
          client_id?: string
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: Database["public"]["Enums"]["client_change_state"]
        }
        Relationships: [
          {
            foreignKeyName: "client_change_approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_merges: {
        Row: {
          at: string
          id: string
          merged_by: string | null
          merged_id: string
          snapshot: Json
          surviving_id: string
        }
        Insert: {
          at?: string
          id?: string
          merged_by?: string | null
          merged_id: string
          snapshot: Json
          surviving_id: string
        }
        Update: {
          at?: string
          id?: string
          merged_by?: string | null
          merged_id?: string
          snapshot?: Json
          surviving_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_merges_merged_id_fkey"
            columns: ["merged_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_merges_surviving_id_fkey"
            columns: ["surviving_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_status_transitions: {
        Row: {
          at: string
          changed_by: string | null
          client_id: string
          from_status: Database["public"]["Enums"]["client_status"] | null
          id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["client_status"]
        }
        Insert: {
          at?: string
          changed_by?: string | null
          client_id: string
          from_status?: Database["public"]["Enums"]["client_status"] | null
          id?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["client_status"]
        }
        Update: {
          at?: string
          changed_by?: string | null
          client_id?: string
          from_status?: Database["public"]["Enums"]["client_status"] | null
          id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["client_status"]
        }
        Relationships: [
          {
            foreignKeyName: "client_status_transitions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_line1: string | null
          address_line2: string | null
          address_postcode: string | null
          address_region: string | null
          alt_phone: string | null
          assigned_agent_id: string | null
          assigned_team_id: string | null
          campaign_source: string | null
          category: string | null
          company: string | null
          consent_status: Database["public"]["Enums"]["consent_state"]
          created_at: string
          deleted_at: string | null
          do_not_call: boolean
          dob: string | null
          email: string | null
          id: string
          last_contacted_at: string | null
          lifecycle_status: Database["public"]["Enums"]["client_status"]
          merged_into_id: string | null
          name: string
          next_follow_up_at: string | null
          notes: string | null
          organization_id: string | null
          owner_id: string
          phone: string | null
          preferred_method: Database["public"]["Enums"]["contact_method"]
          preferred_time: string | null
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postcode?: string | null
          address_region?: string | null
          alt_phone?: string | null
          assigned_agent_id?: string | null
          assigned_team_id?: string | null
          campaign_source?: string | null
          category?: string | null
          company?: string | null
          consent_status?: Database["public"]["Enums"]["consent_state"]
          created_at?: string
          deleted_at?: string | null
          do_not_call?: boolean
          dob?: string | null
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          lifecycle_status?: Database["public"]["Enums"]["client_status"]
          merged_into_id?: string | null
          name: string
          next_follow_up_at?: string | null
          notes?: string | null
          organization_id?: string | null
          owner_id: string
          phone?: string | null
          preferred_method?: Database["public"]["Enums"]["contact_method"]
          preferred_time?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_line1?: string | null
          address_line2?: string | null
          address_postcode?: string | null
          address_region?: string | null
          alt_phone?: string | null
          assigned_agent_id?: string | null
          assigned_team_id?: string | null
          campaign_source?: string | null
          category?: string | null
          company?: string | null
          consent_status?: Database["public"]["Enums"]["consent_state"]
          created_at?: string
          deleted_at?: string | null
          do_not_call?: boolean
          dob?: string | null
          email?: string | null
          id?: string
          last_contacted_at?: string | null
          lifecycle_status?: Database["public"]["Enums"]["client_status"]
          merged_into_id?: string | null
          name?: string
          next_follow_up_at?: string | null
          notes?: string | null
          organization_id?: string | null
          owner_id?: string
          phone?: string | null
          preferred_method?: Database["public"]["Enums"]["contact_method"]
          preferred_time?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      failed_login_attempts: {
        Row: {
          at: string
          id: number
          identifier: string
          ip: unknown
        }
        Insert: {
          at?: string
          id?: number
          identifier: string
          ip?: unknown
        }
        Update: {
          at?: string
          id?: number
          identifier?: string
          ip?: unknown
        }
        Relationships: []
      }
      ip_allowlist: {
        Row: {
          active: boolean
          cidr: unknown
          created_at: string
          created_by: string | null
          id: string
          label: string | null
          organization_id: string
        }
        Insert: {
          active?: boolean
          cidr: unknown
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          organization_id: string
        }
        Update: {
          active?: boolean
          cidr?: unknown
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_allowlist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          at: string
          country: string | null
          device_id: string | null
          id: string
          identifier: string | null
          ip: unknown
          reason: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          at?: string
          country?: string | null
          device_id?: string | null
          id?: string
          identifier?: string | null
          ip?: unknown
          reason?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          at?: string
          country?: string | null
          device_id?: string | null
          id?: string
          identifier?: string | null
          ip?: unknown
          reason?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "login_history_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "user_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          organization_id: string | null
          phone: string | null
          staff_id: string | null
          timezone: string
          updated_at: string
          username: string | null
          working_hours: Json
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          organization_id?: string | null
          phone?: string | null
          staff_id?: string | null
          timezone?: string
          updated_at?: string
          username?: string | null
          working_hours?: Json
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          organization_id?: string | null
          phone?: string | null
          staff_id?: string | null
          timezone?: string
          updated_at?: string
          username?: string | null
          working_hours?: Json
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_criteria: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          label: string
          weight: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          label: string
          weight?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          weight?: number
        }
        Relationships: []
      }
      qa_review_scores: {
        Row: {
          criterion_id: string
          id: string
          review_id: string
          score: number
        }
        Insert: {
          criterion_id: string
          id?: string
          review_id: string
          score: number
        }
        Update: {
          criterion_id?: string
          id?: string
          review_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "qa_review_scores_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "qa_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_review_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "qa_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_reviews: {
        Row: {
          call_id: string
          created_at: string
          id: string
          notes: string | null
          overall_score: number | null
          reviewer_id: string
          updated_at: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          notes?: string | null
          overall_score?: number | null
          reviewer_id: string
          updated_at?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          overall_score?: number | null
          reviewer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_reviews_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: true
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      sso_providers: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          display_name: string
          id: string
          kind: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          display_name: string
          id?: string
          kind: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          kind?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sso_providers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          is_leader: boolean
          joined_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          is_leader?: boolean
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          is_leader?: boolean
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      telephony_settings: {
        Row: {
          default_inbound_team_id: string | null
          organization_id: string
          provider: string
          recording_consent_notice: string | null
          recording_consent_required: boolean
          recording_enabled: boolean
          two_party_consent_regions: string[]
          updated_at: string
          updated_by: string | null
          voicemail_drop_enabled: boolean
          voicemail_drop_legal_ack: boolean
        }
        Insert: {
          default_inbound_team_id?: string | null
          organization_id: string
          provider?: string
          recording_consent_notice?: string | null
          recording_consent_required?: boolean
          recording_enabled?: boolean
          two_party_consent_regions?: string[]
          updated_at?: string
          updated_by?: string | null
          voicemail_drop_enabled?: boolean
          voicemail_drop_legal_ack?: boolean
        }
        Update: {
          default_inbound_team_id?: string | null
          organization_id?: string
          provider?: string
          recording_consent_notice?: string | null
          recording_consent_required?: boolean
          recording_enabled?: boolean
          two_party_consent_regions?: string[]
          updated_at?: string
          updated_by?: string | null
          voicemail_drop_enabled?: boolean
          voicemail_drop_legal_ack?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "telephony_settings_default_inbound_team_id_fkey"
            columns: ["default_inbound_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telephony_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      two_factor_secrets: {
        Row: {
          backup_codes_hashed: string[]
          created_at: string
          enabled: boolean
          enrolled_at: string | null
          last_used_at: string | null
          secret_encrypted: string
          user_id: string
        }
        Insert: {
          backup_codes_hashed?: string[]
          created_at?: string
          enabled?: boolean
          enrolled_at?: string | null
          last_used_at?: string | null
          secret_encrypted: string
          user_id: string
        }
        Update: {
          backup_codes_hashed?: string[]
          created_at?: string
          enabled?: boolean
          enrolled_at?: string | null
          last_used_at?: string | null
          secret_encrypted?: string
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          created_at: string
          device_fingerprint: string
          id: string
          label: string | null
          last_ip: unknown
          last_seen_at: string
          trusted: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          id?: string
          label?: string | null
          last_ip?: unknown
          last_seen_at?: string
          trusted?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          id?: string
          label?: string | null
          last_ip?: unknown
          last_seen_at?: string
          trusted?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          team_id: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_suspended: { Args: { _user_id: string }; Returns: boolean }
      is_valid_client_transition: {
        Args: {
          _from: Database["public"]["Enums"]["client_status"]
          _to: Database["public"]["Enums"]["client_status"]
        }
        Returns: boolean
      }
      max_role_level: { Args: { _user_id: string }; Returns: number }
      record_audit: {
        Args: {
          _action: string
          _actor: string
          _diff: Json
          _ip: unknown
          _org: string
          _target_id: string
          _target_type: string
          _ua: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      agent_presence:
        | "available"
        | "on_call"
        | "acw"
        | "break"
        | "training"
        | "meeting"
        | "offline"
      app_role:
        | "agent"
        | "team_leader"
        | "supervisor"
        | "ops_admin"
        | "super_admin"
      call_direction: "inbound" | "outbound"
      call_status:
        | "queued"
        | "ringing"
        | "in_progress"
        | "on_hold"
        | "completed"
        | "failed"
        | "no_answer"
        | "busy"
        | "voicemail"
        | "abandoned"
        | "canceled"
      client_change_state: "pending" | "approved" | "rejected" | "cancelled"
      client_status:
        | "new"
        | "assigned"
        | "contacted"
        | "follow_up"
        | "interested"
        | "not_interested"
        | "converted"
        | "unreachable"
        | "invalid"
        | "complaint"
        | "escalated"
        | "do_not_call"
        | "closed"
      consent_state: "unknown" | "granted" | "revoked"
      contact_method: "phone" | "email" | "sms" | "whatsapp" | "no_contact"
      monitor_kind: "listen" | "whisper" | "barge" | "takeover"
      transfer_kind: "warm" | "cold" | "conference"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      agent_presence: [
        "available",
        "on_call",
        "acw",
        "break",
        "training",
        "meeting",
        "offline",
      ],
      app_role: [
        "agent",
        "team_leader",
        "supervisor",
        "ops_admin",
        "super_admin",
      ],
      call_direction: ["inbound", "outbound"],
      call_status: [
        "queued",
        "ringing",
        "in_progress",
        "on_hold",
        "completed",
        "failed",
        "no_answer",
        "busy",
        "voicemail",
        "abandoned",
        "canceled",
      ],
      client_change_state: ["pending", "approved", "rejected", "cancelled"],
      client_status: [
        "new",
        "assigned",
        "contacted",
        "follow_up",
        "interested",
        "not_interested",
        "converted",
        "unreachable",
        "invalid",
        "complaint",
        "escalated",
        "do_not_call",
        "closed",
      ],
      consent_state: ["unknown", "granted", "revoked"],
      contact_method: ["phone", "email", "sms", "whatsapp", "no_contact"],
      monitor_kind: ["listen", "whisper", "barge", "takeover"],
      transfer_kind: ["warm", "cold", "conference"],
    },
  },
} as const
