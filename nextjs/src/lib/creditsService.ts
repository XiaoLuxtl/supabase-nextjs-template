import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database.types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

interface CreditOperationResult {
  success: boolean;
  error?: string;
  newBalance?: number;
  video?: Database["public"]["Tables"]["video_generations"]["Row"];
  balanceAfter?: number;
}

interface AtomicTransactionResult {
  success: boolean;
  error?: string;
  video?: Database["public"]["Tables"]["video_generations"]["Row"];
  balanceAfter?: number;
}

interface RpcTransactionResult {
  success: boolean;
  error?: string;
  video_id?: string;
  video_data?: Database["public"]["Tables"]["video_generations"]["Row"];
  new_balance?: number;
  transaction_id?: string;
}

interface RpcRefundResult {
  success: boolean;
  error?: string;
  new_balance?: number;
  transaction_id?: string;
}

export class CreditsService {
  /**
   * ✅ TRANSACCIÓN ATÓMICA: Crear video + consumir créditos
   * Elimina race conditions y garantiza consistencia
   */
  static async createVideoAndConsumeCredits(
    userId: string,
    prompt: string,
    imageBase64?: string
  ): Promise<AtomicTransactionResult> {
    try {
      console.log("🔐 [CreditsService] Starting atomic transaction:", {
        userId,
      });

      const { data, error } = await supabase.rpc(
        "create_video_and_consume_credits_atomic",
        {
          p_user_id: userId,
          p_prompt: prompt,
          p_image_base64: imageBase64,
        }
      );

      if (error) {
        console.error("❌ [CreditsService] Atomic transaction failed:", error);
        return {
          success: false,
          error: this.mapTransactionError(error.message),
        };
      }

      const result: RpcTransactionResult = data as RpcTransactionResult;

      if (!result.success) {
        console.error("❌ [CreditsService] RPC returned error:", result.error);
        return {
          success: false,
          error: result.error || "Unknown RPC error",
        };
      }

      console.log("✅ [CreditsService] Atomic transaction completed:", {
        videoId: result.video_id,
        newBalance: result.new_balance,
      });

      return {
        success: true,
        video: result.video_data,
        balanceAfter: result.new_balance,
      };
    } catch (error) {
      console.error(
        "❌ [CreditsService] Unexpected error in atomic transaction:",
        error
      );
      return {
        success: false,
        error: "Internal server error",
      };
    }
  }

  /**
   * ✅ REEMBOLSO AUTOMÁTICO para fallas de Vidu
   */
  static async refundForViduFailure(
    videoId: string
  ): Promise<CreditOperationResult> {
    try {
      console.log(
        "🔄 [CreditsService] Processing automatic refund for Vidu failure:",
        videoId
      );

      const { data, error } = await supabase.rpc(
        "refund_credits_for_vidu_failure",
        { p_video_id: videoId }
      );

      if (error) {
        console.error("❌ [CreditsService] Auto-refund RPC error:", error);
        return { success: false, error: error.message };
      }

      const result: RpcRefundResult = data as RpcRefundResult;

      if (!result.success) {
        console.error(
          "❌ [CreditsService] Auto-refund RPC failed:",
          result.error
        );
        return {
          success: false,
          error: result.error || "Unknown refund error",
        };
      }

      console.log("✅ [CreditsService] Auto-refund completed:", {
        videoId,
        newBalance: result.new_balance,
      });

      return {
        success: true,
        newBalance: result.new_balance,
      };
    } catch (error) {
      console.error(
        "❌ [CreditsService] Unexpected error in auto-refund:",
        error
      );
      return {
        success: false,
        error: "Refund system error",
      };
    }
  }

  /**
   * ✅ OBTENER BALANCE (solo lectura)
   */
  static async getBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase.rpc("get_user_balance", {
        p_user_id: userId,
      });

      if (error) {
        console.error("❌ [CreditsService] Error getting balance:", error);
        return 0;
      }

      if (typeof data !== "number") {
        console.warn("⚠️ [CreditsService] Balance is not a number:", data);
        return 0;
      }

      return data;
    } catch (error) {
      console.error(
        "❌ [CreditsService] Unexpected error getting balance:",
        error
      );
      return 0;
    }
  }

  /**
   * 🗺️ Mapear errores de transacción a mensajes user-friendly
   */
  private static mapTransactionError(error: string): string {
    const errorMap: Record<string, string> = {
      insufficient_credits: "Créditos insuficientes",
      daily_limit_exceeded: "Límite diario alcanzado",
      video_already_exists: "Generación ya en proceso",
      user_not_found: "Usuario no encontrado",
    };

    return errorMap[error] || error || "Error al procesar la solicitud";
  }

  /**
   * ⚠️ MÉTODO LEGACY - Mantener por compatibilidad temporal
   * @deprecated Usar createVideoAndConsumeCredits en su lugar
   */
  static async consumeCreditsForVideo(
    userId: string,
    videoId: string
  ): Promise<CreditOperationResult> {
    console.warn(
      "⚠️ [CreditsService] DEPRECATED: Using legacy consumeCreditsForVideo"
    );

    try {
      const { data, error } = await supabase.rpc(
        "consume_credit_for_video_secure",
        {
          p_user_id: userId,
          p_video_id: videoId,
        }
      );

      if (error) {
        return { success: false, error: error.message };
      }

      const result: RpcTransactionResult = data as RpcTransactionResult;

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Unknown consumption error",
        };
      }

      return {
        success: true,
        newBalance: result.new_balance,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Error inesperado";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
