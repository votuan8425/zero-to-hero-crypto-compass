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
      admin_allocations: {
        Row: {
          created_at: string
          id: string
          message: string | null
          message_updated_at: string | null
          pnl_pct: number | null
          slices: Json
          started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          message_updated_at?: string | null
          pnl_pct?: number | null
          slices?: Json
          started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          message_updated_at?: string | null
          pnl_pct?: number | null
          slices?: Json
          started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      investor_follows: {
        Row: {
          created_at: string
          follower_id: string
          follower_name: string | null
          id: string
          investor_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          follower_name?: string | null
          id?: string
          investor_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          follower_name?: string | null
          id?: string
          investor_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      metal_prices: {
        Row: {
          ask_vnd: number
          bid_vnd: number
          fetched_at: string
          slot_at: string
          source: string
          symbol: string
        }
        Insert: {
          ask_vnd: number
          bid_vnd: number
          fetched_at?: string
          slot_at: string
          source: string
          symbol: string
        }
        Update: {
          ask_vnd?: number
          bid_vnd?: number
          fetched_at?: string
          slot_at?: string
          source?: string
          symbol?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          investor_id: string
          link: string
          push_attempts: number
          push_sent_at: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          investor_id: string
          link?: string
          push_attempts?: number
          push_sent_at?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          investor_id?: string
          link?: string
          push_attempts?: number
          push_sent_at?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          currency: string
          display_name: string | null
          id: string
          local_migrated_at: string | null
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          display_name?: string | null
          id: string
          local_migrated_at?: string | null
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          local_migrated_at?: string | null
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reference_portfolios: {
        Row: {
          ai_summary: string | null
          created_at: string
          description: string | null
          holdings: Json
          id: string
          image_paths: string[]
          name: string
          notes: string | null
          total_value: number | null
          total_value_currency: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          description?: string | null
          holdings?: Json
          id?: string
          image_paths?: string[]
          name: string
          notes?: string | null
          total_value?: number | null
          total_value_currency?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          description?: string | null
          holdings?: Json
          id?: string
          image_paths?: string[]
          name?: string
          notes?: string | null
          total_value?: number | null
          total_value_currency?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          coin_name: string
          created_at: string
          fee_usd: number
          fee_vnd: number | null
          id: string
          import_key: string | null
          note: string | null
          price_usd: number
          price_vnd: number | null
          quantity: number
          symbol: string
          tx_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coin_name: string
          created_at?: string
          fee_usd?: number
          fee_vnd?: number | null
          id?: string
          import_key?: string | null
          note?: string | null
          price_usd: number
          price_vnd?: number | null
          quantity: number
          symbol: string
          tx_date?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          coin_name?: string
          created_at?: string
          fee_usd?: number
          fee_vnd?: number | null
          id?: string
          import_key?: string | null
          note?: string | null
          price_usd?: number
          price_vnd?: number | null
          quantity?: number
          symbol?: string
          tx_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user: { Args: { p_target: string }; Returns: undefined }
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          currency: string
          display_name: string
          email: string
          holdings: Json
          invested_usd: number
          last_sign_in_at: string
          tx_count: number
          user_id: string
          username: string
        }[]
      }
      admin_update_user: {
        Args: { p_currency: string; p_display_name: string; p_target: string }
        Returns: undefined
      }
      is_admin_caller: { Args: never; Returns: boolean }
      list_published_investors: {
        Args: never
        Returns: {
          updated_at: string
          user_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
