export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]


// Tipos para errores de Mercado Pago (basados en @mercadopago/sdk)
export interface MPErrorBody {
  message: string;
  error: string;
  status: number;  // Código HTTP, e.g., 404
  cause: Array<{
    code: number | null;
    description: string | null;
    data: unknown;
  }>;
}

export interface MPErrors extends Error {
  cause: {
    body: MPErrorBody;
  };
  message: string;
}

// Tipo genérico para el resultado de getPayment
export interface Payment {
  id: number;
  status: string;
  // Agrega otros campos según tu modelo de pago, e.g., amount, transaction_amount, etc.
}

/**
 * Objeto de tiempo de ejecución (runtime) que contiene los modos de cliente.
 * Se exporta como 'const' para que esté disponible en tiempo de ejecución y se use
 * al asignar el modo de cliente (ej. CLIENT_MODES.SPA).
 */

export const CLIENT_MODES = {
  SPA: 'SPA',
  SERVER: 'SERVER',
  SSR: 'SSR',
  STATIC: 'STATIC',
} as const;

/**
 * Definición del tipo de cliente para diferenciar la lógica de Supabase (por ejemplo, SPA vs Server).
 * Este tipo se deriva del objeto CLIENT_MODES.
 */
export type ClientType = (typeof CLIENT_MODES)[keyof typeof CLIENT_MODES];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      credit_packages: {
        Row: {
          created_at: string
          credits_amount: number | null
          description: string | null
          features: Json | null
          id: string
          is_active: boolean
          is_popular: boolean
          min_credits: number | null
          name: string
          package_type: 'fixed' | 'custom' // Corregido: Literal union type
          price_mxn: number | null
          price_per_credit: number | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_amount?: number | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          min_credits?: number | null
          name: string
          package_type: 'fixed' | 'custom'
          price_mxn?: number | null
          price_per_credit?: number | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_amount?: number | null
          description?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          min_credits?: number | null
          name?: string
          package_type?: 'fixed' | 'custom'
          price_mxn?: number | null
          price_per_credit?: number | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          applied_at: string | null
          created_at: string
          credits_amount: number
          id: string
          notes: string | null
          package_id: string | null
          package_name: string
          payment_id: string | null
          payment_method: string
          payment_status: string
          preference_id: string | null
          price_paid_mxn: number
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          credits_amount: number
          id?: string
          notes?: string | null
          package_id?: string | null
          package_name: string
          payment_id?: string | null
          payment_method?: string
          payment_status?: string
          preference_id?: string | null
          price_paid_mxn: number
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          credits_amount?: number
          id?: string
          notes?: string | null
          package_id?: string | null
          package_name?: string
          payment_id?: string | null
          payment_method?: string
          payment_status?: string
          preference_id?: string | null
          price_paid_mxn?: number
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
          created_at: string
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
          created_at?: string
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
          created_at?: string
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
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits_balance: number
          daily_generation_limit: number
          daily_generations_used: number
          daily_reset_date: string
          email: string
          full_name: string | null
          id: string
          last_login_at: string | null
          phone: string | null
          total_credits_purchased: number
          total_videos_generated: number
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits_balance?: number
          daily_generation_limit?: number
          daily_generations_used?: number
          daily_reset_date?: string
          email: string
          full_name?: string | null
          id: string
          last_login_at?: string | null
          phone?: string | null
          total_credits_purchased?: number
          total_videos_generated?: number
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits_balance?: number
          daily_generation_limit?: number
          daily_generations_used?: number
          daily_reset_date?: string
          email?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          total_credits_purchased?: number
          total_videos_generated?: number
          updated_at?: string
        }
        Relationships: []
      }
      video_generations: {
        Row: {
          aspect_ratio: string
          bgm: boolean
          completed_at: string | null
          cover_url: string | null
          created_at: string
          credits_used: number
          duration: number
          error_code: string | null
          error_message: string | null
          id: string
          input_image_path: string | null
          input_image_url: string
          max_retries: number
          model: string
          prompt: string
          resolution: string
          retry_count: number
          started_at: string | null
          status: string
          translated_prompt_en: string
          user_id: string
          video_duration_actual: number | null
          video_fps: number | null
          video_url: string | null
          vidu_creation_id: string | null
          vidu_full_response: Json | null
          vidu_task_id: string | null
        }
        Insert: {
          aspect_ratio?: string
          bgm?: boolean
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string
          credits_used?: number
          duration?: number
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_image_path?: string | null
          input_image_url: string
          max_retries?: number
          model?: string
          prompt: string
          resolution?: string
          retry_count?: number
          started_at?: string | null
          status?: string
          translated_prompt_en?: string | null
          user_id: string
          video_duration_actual?: number | null
          video_fps?: number | null
          video_url?: string | null
          vidu_creation_id?: string | null
          vidu_full_response?: Json | null
          vidu_task_id?: string | null
        }
        Update: {
          aspect_ratio?: string
          bgm?: boolean
          completed_at?: string | null
          cover_url?: string | null
          created_at?: string
          credits_used?: number
          duration?: number
          error_code?: string | null
          error_message?: string | null
          id?: string
          input_image_path?: string | null
          input_image_url?: string
          max_retries?: number
          model?: string
          prompt?: string
          resolution?: string
          retry_count?: number
          started_at?: string | null
          status?: string
          translated_prompt_en?: string | null
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
          processed: boolean
          received_at: string
          vidu_task_id: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          payload: Json
          processed?: boolean
          received_at?: string
          vidu_task_id?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          payload?: Json
          processed?: boolean
          received_at?: string
          vidu_task_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_credit_purchase: {
        Args: { p_purchase_id: string }
        Returns: undefined
      }
      calculate_custom_package_price: {
        Args: { p_credits_amount: number; p_package_id: string }
        Returns: number
      }
      consume_credit_for_video: {
        Args: { p_user_id: string; p_video_id: string }
        Returns: boolean
      }
      is_user_authenticated: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      refund_credit_for_failed_video: {
        Args: { p_video_id: string }
        Returns: undefined
      }
      refund_credits_for_video: {
        Args: { p_video_id: string }
        Returns: boolean
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
