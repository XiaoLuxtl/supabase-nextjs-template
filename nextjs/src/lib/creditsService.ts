// src/lib/creditsService.ts - SERVER ONLY
// ⚠️  This service should only be used in API routes (server-side)
// It uses the service key which should never be exposed to the client

import { createClient } from "@supabase/supabase-js";
import { logger } from "./utils/logger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

export class CreditsService {
  /**
   * Obtiene el balance actual de créditos de un usuario
   */
  static async getBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("credits_balance")
      .eq("id", userId)
      .single();

    if (error) {
      logger.error("Error getting credits balance", { userId, error });
      return 0;
    }

    return data?.credits_balance ?? 0;
  }

  /**
   * Consume créditos de un usuario para generar un video
   */
  static async consumeCreditsForVideo(
    userId: string,
    videoId: string
  ): Promise<{ success: boolean; newBalance: number }> {
    try {
      // Consumir créditos usando la función RPC mejorada
      const { error } = await supabase.rpc("consume_credit_for_video", {
        p_user_id: userId,
        p_video_id: videoId,
      });

      if (error) {
        logger.error("Error consuming credits for video", {
          userId,
          videoId,
          error,
        });
        return { success: false, newBalance: await this.getBalance(userId) };
      }

      const newBalance = await this.getBalance(userId);
      return { success: true, newBalance };
    } catch (error) {
      logger.error("Unexpected error in consumeCreditsForVideo", {
        userId,
        videoId,
        error,
      });
      return { success: false, newBalance: await this.getBalance(userId) };
    }
  }

  /**
   * Agrega créditos a un usuario aplicando una compra
   */
  static async applyPurchaseCredits(
    purchaseId: string
  ): Promise<{ success: boolean; newBalance: number }> {
    try {
      const { error } = await supabase.rpc("apply_credit_purchase", {
        p_purchase_id: purchaseId,
      });

      if (error) {
        logger.error("Error applying purchase credits", { purchaseId, error });
        return { success: false, newBalance: 0 };
      }

      // Obtener el user_id de la compra para devolver el balance actualizado
      const { data: purchase } = await supabase
        .from("credit_purchases")
        .select("user_id")
        .eq("id", purchaseId)
        .single();

      const newBalance = await this.getBalance(purchase?.user_id || "");
      return { success: true, newBalance };
    } catch (error) {
      logger.error("Unexpected error in applyPurchaseCredits", {
        purchaseId,
        error,
      });
      return { success: false, newBalance: 0 };
    }
  }

  /**
   * Reembolsa créditos por un video fallido
   */
  static async refundVideoCredits(
    videoId: string
  ): Promise<{ success: boolean; newBalance: number }> {
    try {
      // Usar la función RPC existente para reembolsar
      const { error } = await supabase.rpc("refund_credits_for_video", {
        p_video_id: videoId,
      });

      if (error) {
        logger.error("Error refunding video credits", { videoId, error });
        return { success: false, newBalance: 0 };
      }

      // Obtener el user_id del video para devolver el balance actualizado
      const { data: video } = await supabase
        .from("video_generations")
        .select("user_id")
        .eq("id", videoId)
        .single();

      const newBalance = await this.getBalance(video?.user_id || "");
      return { success: true, newBalance };
    } catch (error) {
      logger.error("Unexpected error in refundVideoCredits", {
        videoId,
        error,
      });
      return { success: false, newBalance: 0 };
    }
  }

  /**
   * Verifica si un usuario puede costear una operación
   */
  static async canAfford(userId: string, cost: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= cost;
  }

  /**
   * Transfiere créditos entre usuarios (para futuras funcionalidades)
   */
  static async transferCredits(
    fromUserId: string,
    toUserId: string,
    amount: number
  ): Promise<{ success: boolean; fromBalance: number; toBalance: number }> {
    try {
      // Verificar que el usuario origen tenga suficientes créditos
      const fromBalance = await this.getBalance(fromUserId);
      if (fromBalance < amount) {
        return {
          success: false,
          fromBalance,
          toBalance: await this.getBalance(toUserId),
        };
      }

      // Realizar la transferencia (esto requeriría una función RPC específica)
      // Por ahora, devolver error ya que no está implementado
      console.warn("Transfer functionality not implemented yet");
      return {
        success: false,
        fromBalance,
        toBalance: await this.getBalance(toUserId),
      };
    } catch (error) {
      logger.error("Unexpected error in transferCredits", {
        fromUserId,
        toUserId,
        amount,
        error,
      });
      return {
        success: false,
        fromBalance: await this.getBalance(fromUserId),
        toBalance: await this.getBalance(toUserId),
      };
    }
  }
}
