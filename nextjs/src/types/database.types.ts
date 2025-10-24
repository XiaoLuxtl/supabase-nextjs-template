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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      credit_packages: {
        Row: {
          created_at: string | null
          credits_amount: number | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          min_credits: number | null
          name: string
          package_type: string
          price_mxn: number | null
          price_per_credit: number | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credits_amount?: number | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          min_credits?: number | null
          name: string
          package_type: string
          price_mxn?: number | null
          price_per_credit?: number | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credits_amount?: number | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          min_credits?: number | null
          name?: string
          package_type?: string
          price_mxn?: number | null
          price_per_credit?: number | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          applied_at: string | null
          created_at: string | null
          credits_amount: number
          id: string
          notes: string | null
          package_id: string | null
          package_name: string
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          preference_id: string | null
          price_paid_mxn: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string | null
          credits_amount: number
          id?: string
          notes?: string | null
          package_id?: string | null
          package_name: string
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          preference_id?: string | null
          price_paid_mxn: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string | null
          credits_amount?: number
          id?: string
          notes?: string | null
          package_id?: string | null
          package_name?: string
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          preference_id?: string | null
          price_paid_mxn?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string
          id: string
          purchase_id: string | null
          transaction_type: string
          user_id: string
          video_id: string | null
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description: string
          id?: string
          purchase_id?: string | null
          transaction_type: string
          user_id: string
          video_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string
          id?: string
          purchase_id?: string | null
          transaction_type?: string
          user_id?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "credit_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "video_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      mercadopago_webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string | null
          id: string
          is_valid: boolean | null
          payload: Json | null
          payment_id: string | null
          processed: boolean | null
          signature: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          is_valid?: boolean | null
          payload?: Json | null
          payment_id?: string | null
          processed?: boolean | null
          signature?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          is_valid?: boolean | null
          payload?: Json | null
          payment_id?: string | null
          processed?: boolean | null
          signature?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          credits_balance: number
          daily_generation_limit: number | null
          daily_generations_used: number | null
          daily_reset_date: string | null
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          phone: string | null
          total_credits_purchased: number
          total_videos_generated: number
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          credits_balance?: number
          daily_generation_limit?: number | null
          daily_generations_used?: number | null
          daily_reset_date?: string | null
          email: string
          full_name?: string | null
          id: string
          last_login_at?: string | null
          phone?: string | null
          total_credits_purchased?: number
          total_videos_generated?: number
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          credits_balance?: number
          daily_generation_limit?: number | null
          daily_generations_used?: number | null
          daily_reset_date?: string | null
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          total_credits_purchased?: number
          total_videos_generated?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      video_generations: {
        Row: {
          aspect_ratio: string | null
          bgm: boolean | null
          completed_at: string | null
          cover_url: string | null
          created_at: string | null
          credits_used: number | null
          duration: number | null
          error_code: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          model: string | null
          prompt: string
          resolution: string | null
          retry_count: number | null
          started_at: string | null
          status: string | null
          translated_prompt_en: string | null
          updated_at: string | null
          user_id: string
          video_duration_actual: number | null
          video_fps: number | null
          video_url: string | null
          vidu_creation_id: string | null
          vidu_full_response: Json | null
          vidu_task_id: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          bgm?: boolean | null
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string | null
          credits_used?: number | null
          duration?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          model?: string | null
          prompt: string
          resolution?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          translated_prompt_en?: string | null
          updated_at?: string | null
          user_id: string
          video_duration_actual?: number | null
          video_fps?: number | null
          video_url?: string | null
          vidu_creation_id?: string | null
          vidu_full_response?: Json | null
          vidu_task_id?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          bgm?: boolean | null
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string | null
          credits_used?: number | null
          duration?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          model?: string | null
          prompt?: string
          resolution?: string | null
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          translated_prompt_en?: string | null
          updated_at?: string | null
          user_id?: string
          video_duration_actual?: number | null
          video_fps?: number | null
          video_url?: string | null
          vidu_creation_id?: string | null
          vidu_full_response?: Json | null
          vidu_task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_generations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vidu_webhook_logs: {
        Row: {
          error_message: string | null
          id: string
          payload: Json
          processed: boolean | null
          received_at: string | null
          vidu_task_id: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          payload: Json
          processed?: boolean | null
          received_at?: string | null
          vidu_task_id?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          payload?: Json
          processed?: boolean | null
          received_at?: string | null
          vidu_task_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_credit_purchase_secure: {
        Args: { p_purchase_id: string }
        Returns: Json
      }
      apply_credit_purchase_webhook: {
        Args: { p_purchase_id: string }
        Returns: Json
      }
      calculate_custom_package_price: {
        Args: { p_credits_amount: number; p_package_id: string }
        Returns: number
      }
      consume_credit_for_video_secure: {
        Args: { p_user_id: string; p_video_id: string }
        Returns: Json
      }
      create_video_and_consume_credits_atomic: {
        Args: { p_image_base64?: string; p_prompt: string; p_user_id: string }
        Returns: Json
      }
      is_user_authenticated: { Args: never; Returns: boolean }
      log_credit_transaction_secure: {
        Args: {
          p_amount: number
          p_description?: string
          p_purchase_id?: string
          p_transaction_type: string
          p_user_id: string
          p_video_id?: string
        }
        Returns: string
      }
      refund_credits_for_video: { Args: { p_video_id: string }; Returns: Json }
      refund_credits_for_video_service: {
        Args: { p_video_id: string }
        Returns: Json
      }
      refund_credits_for_vidu_failure: {
        Args: { p_video_id: string }
        Returns: Json
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
    Enums: {},
  },
} as const
