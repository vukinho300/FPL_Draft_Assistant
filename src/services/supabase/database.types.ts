export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      fantacalcio_access: {
        Row: {
          auth_user_id: string
          granted_at: string
        }
        Insert: {
          auth_user_id: string
          granted_at?: string
        }
        Update: {
          auth_user_id?: string
          granted_at?: string
        }
        Relationships: []
      }
      fantacalcio_auction_events: {
        Row: {
          actor_auth_user_id: string
          client_request_id: string
          id: string
          kind: string
          manager_id: string | null
          note: string | null
          player_ref: string | null
          price: number | null
          recorded_at: string
          reverts_sale_id: string | null
          role: string | null
          sequence_no: number
          session_id: string
        }
        Insert: {
          actor_auth_user_id?: string
          client_request_id: string
          id?: string
          kind: string
          manager_id?: string | null
          note?: string | null
          player_ref?: string | null
          price?: number | null
          recorded_at?: string
          reverts_sale_id?: string | null
          role?: string | null
          sequence_no?: number
          session_id: string
        }
        Update: {
          actor_auth_user_id?: string
          client_request_id?: string
          id?: string
          kind?: string
          manager_id?: string | null
          note?: string | null
          player_ref?: string | null
          price?: number | null
          recorded_at?: string
          reverts_sale_id?: string | null
          role?: string | null
          sequence_no?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fantacalcio_auction_events_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "fantacalcio_auction_managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantacalcio_auction_events_reverts_sale_id_fkey"
            columns: ["reverts_sale_id"]
            isOneToOne: true
            referencedRelation: "fantacalcio_auction_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantacalcio_auction_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "fantacalcio_auction_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fantacalcio_auction_managers: {
        Row: {
          display_name: string
          id: string
          session_id: string
        }
        Insert: {
          display_name: string
          id?: string
          session_id: string
        }
        Update: {
          display_name?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fantacalcio_auction_managers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "fantacalcio_auction_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fantacalcio_auction_sessions: {
        Row: {
          att_slots: number
          cen_slots: number
          created_at: string
          dif_slots: number
          id: string
          initial_credits: number
          minimum_price: number
          next_event_sequence: number
          por_slots: number
          position_sequence: string[] | null
          season: string
        }
        Insert: {
          att_slots: number
          cen_slots: number
          created_at?: string
          dif_slots: number
          id?: string
          initial_credits: number
          minimum_price: number
          next_event_sequence?: number
          por_slots: number
          position_sequence?: string[] | null
          season: string
        }
        Update: {
          att_slots?: number
          cen_slots?: number
          created_at?: string
          dif_slots?: number
          id?: string
          initial_credits?: number
          minimum_price?: number
          next_event_sequence?: number
          por_slots?: number
          position_sequence?: string[] | null
          season?: string
        }
        Relationships: []
      }
      league_accounts: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          manager_name: string
          role: Database["public"]["Enums"]["league_account_role"]
          team_name: string
          team_slug: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          manager_name: string
          role: Database["public"]["Enums"]["league_account_role"]
          team_name: string
          team_slug: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          manager_name?: string
          role?: Database["public"]["Enums"]["league_account_role"]
          team_name?: string
          team_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_profiles: {
        Row: {
          account_id: string
          avatar_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          account_id: string
          avatar_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          avatar_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "league_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      league_account_role: "MEMBER" | "LEAGUE_OWNER"
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
      league_account_role: ["MEMBER", "LEAGUE_OWNER"],
    },
  },
} as const
