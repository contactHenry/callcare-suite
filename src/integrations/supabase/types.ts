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
      announcement_reads: {
        Row: {
          acknowledged_at: string
          announcement_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          announcement_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          announcement_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          author_id: string
          body: string
          created_at: string
          id: string
          organization_id: string | null
          require_ack: boolean
          team_id: string | null
          title: string
          urgency: string
        }
        Insert: {
          audience?: string
          author_id: string
          body: string
          created_at?: string
          id?: string
          organization_id?: string | null
          require_ack?: boolean
          team_id?: string | null
          title: string
          urgency?: string
        }
        Update: {
          audience?: string
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          organization_id?: string | null
          require_ack?: boolean
          team_id?: string | null
          title?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_punches: {
        Row: {
          at: string
          id: string
          kind: string
          note: string | null
          user_id: string
        }
        Insert: {
          at?: string
          id?: string
          kind: string
          note?: string | null
          user_id: string
        }
        Update: {
          at?: string
          id?: string
          kind?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      attendance_shifts: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          notes: string | null
          starts_at: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at: string
          id?: string
          notes?: string | null
          starts_at: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          notes?: string | null
          starts_at?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_shifts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      call_notes: {
        Row: {
          action_required: string | null
          agent_id: string
          call_id: string
          complaint: boolean
          concerns: string | null
          consent_update: string | null
          created_at: string
          follow_up_task_id: string | null
          id: string
          next_action: string | null
          outcome_code: string | null
          priority: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          action_required?: string | null
          agent_id: string
          call_id: string
          complaint?: boolean
          concerns?: string | null
          consent_update?: string | null
          created_at?: string
          follow_up_task_id?: string | null
          id?: string
          next_action?: string | null
          outcome_code?: string | null
          priority?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          action_required?: string | null
          agent_id?: string
          call_id?: string
          complaint?: boolean
          concerns?: string | null
          consent_update?: string | null
          created_at?: string
          follow_up_task_id?: string | null
          id?: string
          next_action?: string | null
          outcome_code?: string | null
          priority?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_notes_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_notes_follow_up_task_fk"
            columns: ["follow_up_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      call_outcome_definitions: {
        Row: {
          campaign_id: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          organization_id: string | null
          polarity: string
          requires_follow_up: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          organization_id?: string | null
          polarity?: string
          requires_follow_up?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          organization_id?: string | null
          polarity?: string
          requires_follow_up?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_outcome_definitions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_outcome_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "client_profiles"
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
      call_script_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          changelog: string | null
          created_at: string
          created_by: string | null
          id: string
          script_id: string
          status: Database["public"]["Enums"]["script_status"]
          tree: Json
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          script_id: string
          status?: Database["public"]["Enums"]["script_status"]
          tree?: Json
          version: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          changelog?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          script_id?: string
          status?: Database["public"]["Enums"]["script_status"]
          tree?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "call_script_versions_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "call_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_scripts: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          current_version_id: string | null
          description: string | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_scripts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_scripts_current_version_fk"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "call_script_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_scripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          disposition_id: string | null
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
          disposition_id?: string | null
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
          disposition_id?: string | null
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
            referencedRelation: "client_profiles"
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
            foreignKeyName: "calls_disposition_id_fkey"
            columns: ["disposition_id"]
            isOneToOne: false
            referencedRelation: "call_outcome_definitions"
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
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_change_approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_consents: {
        Row: {
          captured_at: string
          captured_by: string | null
          client_id: string
          consent_type: string
          evidence_url: string | null
          id: string
          notes: string | null
          organization_id: string | null
          source: string | null
          state: Database["public"]["Enums"]["consent_state"]
          superseded_at: string | null
        }
        Insert: {
          captured_at?: string
          captured_by?: string | null
          client_id: string
          consent_type: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          source?: string | null
          state: Database["public"]["Enums"]["consent_state"]
          superseded_at?: string | null
        }
        Update: {
          captured_at?: string
          captured_by?: string | null
          client_id?: string
          consent_type?: string
          evidence_url?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          source?: string | null
          state?: Database["public"]["Enums"]["consent_state"]
          superseded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_consents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contact_methods: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_primary: boolean
          label: string | null
          method: Database["public"]["Enums"]["contact_method"]
          normalized_value: string | null
          organization_id: string | null
          updated_at: string
          value: string
          verified_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          method: Database["public"]["Enums"]["contact_method"]
          normalized_value?: string | null
          organization_id?: string | null
          updated_at?: string
          value: string
          verified_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          method?: Database["public"]["Enums"]["contact_method"]
          normalized_value?: string | null
          organization_id?: string | null
          updated_at?: string
          value?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contact_methods_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contact_methods_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contact_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_export_requests: {
        Row: {
          client_ids: string[]
          created_at: string
          delivered_count: number | null
          filter_snapshot: Json
          id: string
          organization_id: string | null
          reason: string | null
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string
          state: string
          updated_at: string
        }
        Insert: {
          client_ids?: string[]
          created_at?: string
          delivered_count?: number | null
          filter_snapshot?: Json
          id?: string
          organization_id?: string | null
          reason?: string | null
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          state?: string
          updated_at?: string
        }
        Update: {
          client_ids?: string[]
          created_at?: string
          delivered_count?: number | null
          filter_snapshot?: Json
          id?: string
          organization_id?: string | null
          reason?: string | null
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_export_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "client_profiles"
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
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_status_transitions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_updates: {
        Row: {
          author_id: string
          body: string
          complaint_id: string
          created_at: string
          id: string
          status_change: Database["public"]["Enums"]["complaint_status"] | null
        }
        Insert: {
          author_id: string
          body: string
          complaint_id: string
          created_at?: string
          id?: string
          status_change?: Database["public"]["Enums"]["complaint_status"] | null
        }
        Update: {
          author_id?: string
          body?: string
          complaint_id?: string
          created_at?: string
          id?: string
          status_change?: Database["public"]["Enums"]["complaint_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_updates_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          call_id: string | null
          category: string | null
          client_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          organization_id: string | null
          owner_id: string | null
          priority: Database["public"]["Enums"]["complaint_priority"]
          raised_by: string | null
          resolution: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          call_id?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          organization_id?: string | null
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          raised_by?: string | null
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          call_id?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          organization_id?: string | null
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["complaint_priority"]
          raised_by?: string | null
          resolution?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "client_profiles"
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
      custom_role_permissions: {
        Row: {
          permission: string
          role_id: string
        }
        Insert: {
          permission: string
          role_id: string
        }
        Update: {
          permission?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      data_requests: {
        Row: {
          client_id: string | null
          created_at: string
          fulfilled_at: string | null
          id: string
          kind: string
          notes: string | null
          organization_id: string | null
          reason: string | null
          requested_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          kind: string
          notes?: string | null
          organization_id?: string | null
          reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          kind?: string
          notes?: string | null
          organization_id?: string | null
          reason?: string | null
          requested_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_requests_organization_id_fkey"
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
      integrations: {
        Row: {
          category: string
          config: Json
          configured_by: string | null
          created_at: string
          id: string
          last_sync_at: string | null
          organization_id: string | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          config?: Json
          configured_by?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          organization_id?: string | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          config?: Json
          configured_by?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string | null
          organization_id?: string | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      notification_preferences: {
        Row: {
          email: boolean
          in_app: boolean
          kind: string
          sms: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: boolean
          in_app?: boolean
          kind: string
          sms?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: boolean
          in_app?: boolean
          kind?: string
          sms?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          id: string
          kind: string
          link: string | null
          organization_id: string | null
          read_at: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          organization_id?: string | null
          read_at?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          organization_id?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          billing_cycle: string
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          org_id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          org_id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          audit_retention_days: number
          contact_days: number[]
          contact_hours_end: string
          contact_hours_start: string
          contact_hours_timezone: string
          created_at: string
          id: string
          name: string
          record_retention_days: number
          recording_retention_days: number
          region: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          audit_retention_days?: number
          contact_days?: number[]
          contact_hours_end?: string
          contact_hours_start?: string
          contact_hours_timezone?: string
          created_at?: string
          id?: string
          name: string
          record_retention_days?: number
          recording_retention_days?: number
          region?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          audit_retention_days?: number
          contact_days?: number[]
          contact_hours_end?: string
          contact_hours_start?: string
          contact_hours_timezone?: string
          created_at?: string
          id?: string
          name?: string
          record_retention_days?: number
          recording_retention_days?: number
          region?: string | null
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
      qa_acknowledgements: {
        Row: {
          acknowledged_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_acknowledgements_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "qa_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_coaching_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          recommendation: string | null
          review_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          recommendation?: string | null
          review_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          recommendation?: string | null
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_coaching_notes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "qa_reviews"
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
      qa_disputes: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          moderator_id: string | null
          moderator_note: string | null
          reason: string
          resolved_at: string | null
          review_id: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          moderator_id?: string | null
          moderator_note?: string | null
          reason: string
          resolved_at?: string | null
          review_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          moderator_id?: string | null
          moderator_note?: string | null
          reason?: string
          resolved_at?: string | null
          review_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_disputes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "qa_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_review_assignments: {
        Row: {
          call_id: string
          created_at: string
          due_at: string | null
          id: string
          reviewer_id: string
          scorecard_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          call_id: string
          created_at?: string
          due_at?: string | null
          id?: string
          reviewer_id: string
          scorecard_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          call_id?: string
          created_at?: string
          due_at?: string | null
          id?: string
          reviewer_id?: string
          scorecard_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_review_assignments_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_review_assignments_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "qa_scorecards"
            referencedColumns: ["id"]
          },
        ]
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
      qa_scorecard_items: {
        Row: {
          created_at: string
          id: string
          is_critical: boolean
          max_score: number
          prompt: string
          section_id: string
          sort_order: number
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_critical?: boolean
          max_score?: number
          prompt: string
          section_id: string
          sort_order?: number
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_critical?: boolean
          max_score?: number
          prompt?: string
          section_id?: string
          sort_order?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "qa_scorecard_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "qa_scorecard_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_scorecard_sections: {
        Row: {
          created_at: string
          id: string
          name: string
          scorecard_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          scorecard_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          scorecard_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "qa_scorecard_sections_scorecard_id_fkey"
            columns: ["scorecard_id"]
            isOneToOne: false
            referencedRelation: "qa_scorecards"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_scorecards: {
        Row: {
          campaign_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          pass_threshold: number
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          pass_threshold?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          pass_threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_scorecards_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qa_scorecards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_runs: {
        Row: {
          created_at: string
          filters: Json
          format: string
          id: string
          organization_id: string | null
          report_key: string
          row_count: number | null
          run_by: string | null
        }
        Insert: {
          created_at?: string
          filters?: Json
          format?: string
          id?: string
          organization_id?: string | null
          report_key: string
          row_count?: number | null
          run_by?: string | null
        }
        Update: {
          created_at?: string
          filters?: Json
          format?: string
          id?: string
          organization_id?: string | null
          report_key?: string
          row_count?: number | null
          run_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      script_acknowledgements: {
        Row: {
          acknowledged_at: string
          id: string
          user_id: string
          version_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          user_id: string
          version_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          user_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_acknowledgements_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "call_script_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          shift_id: string
          status: string
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id: string
          status?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id?: string
          status?: string
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "attendance_shifts"
            referencedColumns: ["id"]
          },
        ]
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
      subscription_events: {
        Row: {
          created_at: string
          event_type: string
          from_plan_id: string | null
          id: string
          metadata: Json
          org_id: string
          to_plan_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          from_plan_id?: string | null
          id?: string
          metadata?: Json
          org_id: string
          to_plan_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          from_plan_id?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          to_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_from_plan_id_fkey"
            columns: ["from_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_events_to_plan_id_fkey"
            columns: ["to_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          active: boolean
          created_at: string
          features: Json
          id: string
          is_enterprise: boolean
          is_popular: boolean
          max_teams: number | null
          max_users: number | null
          name: string
          price_annual: number | null
          price_monthly: number
          slug: string
          sort_order: number
          storage_gb: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          is_enterprise?: boolean
          is_popular?: boolean
          max_teams?: number | null
          max_users?: number | null
          name: string
          price_annual?: number | null
          price_monthly: number
          slug: string
          sort_order?: number
          storage_gb?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          features?: Json
          id?: string
          is_enterprise?: boolean
          is_popular?: boolean
          max_teams?: number | null
          max_users?: number | null
          name?: string
          price_annual?: number | null
          price_monthly?: number
          slug?: string
          sort_order?: number
          storage_gb?: number | null
        }
        Relationships: []
      }
      support_ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          is_staff_reply: boolean
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          is_staff_reply?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: Database["public"]["Enums"]["support_ticket_category"]
          created_at: string
          created_by: string
          description: string
          id: string
          organization_id: string | null
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          resolved_at: string | null
          resolved_by: string | null
          screenshot_path: string | null
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["support_ticket_category"]
          created_at?: string
          created_by: string
          description: string
          id?: string
          organization_id?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["support_ticket_category"]
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          organization_id?: string | null
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          resolved_at?: string | null
          resolved_by?: string | null
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_team_id: string | null
          assigned_to: string | null
          call_id: string | null
          campaign_id: string | null
          client_id: string | null
          completed_at: string | null
          completion_note: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          escalated: boolean
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          organization_id: string | null
          priority: string
          recurrence_rule: string | null
          remind_at: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_team_id?: string | null
          assigned_to?: string | null
          call_id?: string | null
          campaign_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          completion_note?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          escalated?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          organization_id?: string | null
          priority?: string
          recurrence_rule?: string | null
          remind_at?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_team_id?: string | null
          assigned_to?: string | null
          call_id?: string | null
          campaign_id?: string | null
          client_id?: string | null
          completed_at?: string | null
          completion_note?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          escalated?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          organization_id?: string | null
          priority?: string
          recurrence_rule?: string | null
          remind_at?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
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
      user_custom_role_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_role_assignments_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
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
      client_profiles: {
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
          consent_status: Database["public"]["Enums"]["consent_state"] | null
          created_at: string | null
          deleted_at: string | null
          do_not_call: boolean | null
          dob: string | null
          email: string | null
          id: string | null
          last_contacted_at: string | null
          lifecycle_status: Database["public"]["Enums"]["client_status"] | null
          merged_into_id: string | null
          name: string | null
          next_follow_up_at: string | null
          notes: string | null
          organization_id: string | null
          owner_id: string | null
          phone: string | null
          preferred_method: Database["public"]["Enums"]["contact_method"] | null
          preferred_time: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
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
          consent_status?: Database["public"]["Enums"]["consent_state"] | null
          created_at?: string | null
          deleted_at?: string | null
          do_not_call?: boolean | null
          dob?: string | null
          email?: string | null
          id?: string | null
          last_contacted_at?: string | null
          lifecycle_status?: Database["public"]["Enums"]["client_status"] | null
          merged_into_id?: string | null
          name?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          organization_id?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_method?:
            | Database["public"]["Enums"]["contact_method"]
            | null
          preferred_time?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
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
          consent_status?: Database["public"]["Enums"]["consent_state"] | null
          created_at?: string | null
          deleted_at?: string | null
          do_not_call?: boolean | null
          dob?: string | null
          email?: string | null
          id?: string | null
          last_contacted_at?: string | null
          lifecycle_status?: Database["public"]["Enums"]["client_status"] | null
          merged_into_id?: string | null
          name?: string | null
          next_follow_up_at?: string | null
          notes?: string | null
          organization_id?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_method?:
            | Database["public"]["Enums"]["contact_method"]
            | null
          preferred_time?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
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
            referencedRelation: "client_profiles"
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
      is_team_leader_of: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_valid_client_transition: {
        Args: {
          _from: Database["public"]["Enums"]["client_status"]
          _to: Database["public"]["Enums"]["client_status"]
        }
        Returns: boolean
      }
      list_permission_catalog: {
        Args: never
        Returns: {
          permission: string
        }[]
      }
      max_role_level: { Args: { _user_id: string }; Returns: number }
      notify: {
        Args: {
          _body?: string
          _channel?: string
          _kind: string
          _link?: string
          _severity?: string
          _title: string
          _user: string
        }
        Returns: string
      }
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
      complaint_priority: "low" | "normal" | "high" | "urgent"
      complaint_status:
        | "open"
        | "investigating"
        | "resolved"
        | "closed"
        | "escalated"
      consent_state: "unknown" | "granted" | "revoked"
      contact_method: "phone" | "email" | "sms" | "whatsapp" | "no_contact"
      monitor_kind: "listen" | "whisper" | "barge" | "takeover"
      script_status: "draft" | "in_review" | "approved" | "archived"
      support_ticket_category:
        | "bug"
        | "feature_request"
        | "billing"
        | "account"
        | "integration"
        | "other"
      support_ticket_priority: "low" | "normal" | "high" | "urgent"
      support_ticket_status:
        | "open"
        | "in_progress"
        | "waiting"
        | "resolved"
        | "closed"
      task_kind:
        | "follow_up"
        | "callback"
        | "admin"
        | "coaching"
        | "escalation"
        | "other"
      task_status:
        | "open"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "escalated"
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
      complaint_priority: ["low", "normal", "high", "urgent"],
      complaint_status: [
        "open",
        "investigating",
        "resolved",
        "closed",
        "escalated",
      ],
      consent_state: ["unknown", "granted", "revoked"],
      contact_method: ["phone", "email", "sms", "whatsapp", "no_contact"],
      monitor_kind: ["listen", "whisper", "barge", "takeover"],
      script_status: ["draft", "in_review", "approved", "archived"],
      support_ticket_category: [
        "bug",
        "feature_request",
        "billing",
        "account",
        "integration",
        "other",
      ],
      support_ticket_priority: ["low", "normal", "high", "urgent"],
      support_ticket_status: [
        "open",
        "in_progress",
        "waiting",
        "resolved",
        "closed",
      ],
      task_kind: [
        "follow_up",
        "callback",
        "admin",
        "coaching",
        "escalation",
        "other",
      ],
      task_status: [
        "open",
        "in_progress",
        "completed",
        "cancelled",
        "escalated",
      ],
      transfer_kind: ["warm", "cold", "conference"],
    },
  },
} as const
