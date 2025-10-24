// /lib/creditsService.ts - VERSIÓN UNIFICADA Y MEJORADA
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

interface CreditOperationResult {
  success: boolean;
  error?: string;
  newBalance?: number;
  transactionId?: number;
}

interface RpcResponse {
  success: boolean;
  error?: string;
  new_balance?: number;
  transaction_id?: number;
}

export class CreditsService {
  /**
   * ✅ CONSUMO SEGURO DE CRÉDITOS - ÚNICA FUENTE DE VERDAD
   */
  static async consumeCreditsForVideo(
    userId: string,
    videoId: string
  ): Promise<CreditOperationResult> {
    try {
      // 🔒 Validación adicional de seguridad
      if (!userId || typeof userId !== "string") {
        return {
          success: false,
          error: "User ID inválido",
        };
      }

      // Validar formato UUID
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        return {
          success: false,
          error: "Formato de User ID inválido",
        };
      }

      if (!videoId || typeof videoId !== "string" || !uuidRegex.test(videoId)) {
        return {
          success: false,
          error: "Video ID inválido",
        };
      }

      console.log("🔐 Consumiendo créditos de forma segura:", {
        userId,
        videoId,
      });

      // Usar el cliente con service key para operaciones directas
      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.PRIVATE_SUPABASE_SERVICE_KEY!
      );

      // ✅ 1. Verificar que el usuario existe y obtener balance actual (TABLA CORRECTA)
      const { data: userProfile, error: userError } = await adminSupabase
        .from("user_profiles") // ← TABLA CORRECTA
        .select("credits_balance")
        .eq("id", userId) // ← COLUMNA CORRECTA
        .single();

      if (userError || !userProfile) {
        console.error("❌ Error obteniendo balance del usuario:", userError);
        return {
          success: false,
          error: "Usuario no encontrado o error de base de datos",
        };
      }

      const currentBalance = userProfile.credits_balance; // ← CAMPO CORRECTO
      console.log(`💰 Balance actual: ${currentBalance}`);

      // 2. Verificar que tenga suficientes créditos
      if (currentBalance < 1) {
        return {
          success: false,
          error: "Créditos insuficientes",
        };
      }

      // 3. Consumir 1 crédito de forma atómica
      const newBalance = currentBalance - 1;

      const { error: updateError } = await adminSupabase
        .from("user_profiles") // ← TABLA CORRECTA
        .update({
          credits_balance: newBalance, // ← CAMPO CORRECTO
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId); // ← COLUMNA CORRECTA

      if (updateError) {
        console.error("❌ Error actualizando balance:", updateError);
        return {
          success: false,
          error: `Error actualizando balance: ${updateError.message}`,
        };
      }

      // 4. Registrar la transacción
      const { error: transactionError } = await adminSupabase
        .from("credit_transactions")
        .insert({
          user_id: userId,
          amount: -1,
          balance_after: newBalance, // ← IMPORTANTE: agregar este campo
          transaction_type: "video_generation",
          description: "Generación de video con Vidu",
          video_id: videoId,
          created_at: new Date().toISOString(),
        });

      if (transactionError) {
        console.error("❌ Error registrando transacción:", transactionError);
        // No retornamos error aquí porque el consumo ya se hizo
      }

      console.log(`✅ Créditos consumidos. Nuevo balance: ${newBalance}`);

      return {
        success: true,
        newBalance,
        transactionId: undefined,
      };
    } catch (error) {
      console.error("❌ Error inesperado en consumeCreditsForVideo:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      };
    }
  }

  /**
   * ✅ REEMBOLSO SEGURO DE CRÉDITOS
   */
  static async refundVideoCredits(
    videoId: string
  ): Promise<CreditOperationResult> {
    try {
      console.log("🔄 Procesando reembolso para video:", videoId);

      // Primero obtener información del video para validar
      const { data: video, error: videoError } = await supabase
        .from("video_generations")
        .select("user_id, credits_used, status")
        .eq("id", videoId)
        .single();

      if (videoError || !video) {
        return {
          success: false,
          error: "Video no encontrado",
        };
      }

      // Solo reembolsar si se usaron créditos
      if (video.credits_used === 0) {
        console.log("ℹ️ No hay créditos que reembolsar");
        return {
          success: true,
          newBalance: await this.getBalance(video.user_id),
        };
      }

      // Usar RPC segura para reembolso
      const { error, data } = await supabase.rpc("refund_credits_for_video", {
        p_video_id: videoId,
      });

      if (error) {
        console.error("❌ RPC Error en reembolso:", error);
        return {
          success: false,
          error: `Error en reembolso: ${error.message}`,
        };
      }

      const rpcResponse = data as RpcResponse;

      if (!rpcResponse || !rpcResponse.success) {
        return {
          success: false,
          error: rpcResponse?.error || "Error desconocido en reembolso",
        };
      }

      console.log(
        `✅ Reembolso exitoso. Nuevo balance: ${rpcResponse.new_balance}`
      );

      return {
        success: true,
        newBalance: rpcResponse.new_balance,
        transactionId: rpcResponse.transaction_id,
      };
    } catch (error) {
      console.error("❌ Error inesperado en refundVideoCredits:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      };
    }
  }

  /**
   * ✅ OBTENER BALANCE ACTUAL
   */
  static async getBalance(userId: string): Promise<number> {
    try {
      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("credits_balance")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("❌ Error obteniendo balance:", error);
        return 0;
      }

      return profile?.credits_balance || 0;
    } catch (error) {
      console.error("❌ Error inesperado obteniendo balance:", error);
      return 0;
    }
  }

  /**
   * ✅ VALIDAR CRÉDITOS SUFICIENTES
   */
  static async validateSufficientCredits(userId: string): Promise<{
    isValid: boolean;
    currentBalance: number;
    error?: string;
  }> {
    try {
      const balance = await this.getBalance(userId);

      if (balance < 1) {
        return {
          isValid: false,
          currentBalance: balance,
          error: "Créditos insuficientes",
        };
      }

      return {
        isValid: true,
        currentBalance: balance,
      };
    } catch (error) {
      console.error("❌ Error validando créditos:", error);
      return {
        isValid: false,
        currentBalance: 0,
        error: "Error al validar créditos",
      };
    }
  }
}
