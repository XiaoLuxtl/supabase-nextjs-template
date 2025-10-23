import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CreditPurchase, ApplyCreditResult } from "../types";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Cliente de Supabase específico para webhooks (server-side)
 * No necesita autenticación de usuario, solo acceso a datos
 */
async function createWebhookSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Ignorar en contexto de webhook
          }
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export class SupabaseClient {
  /**
   * Obtiene el cliente de Supabase para webhooks
   */
  private static async getClient() {
    return createWebhookSupabaseClient();
  }

  static async findPendingPurchase(): Promise<CreditPurchase | null> {
    try {
      const supabase = await this.getClient();

      const { data: recentPurchases, error } = await supabase
        .from("credit_purchases")
        .select("*")
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        console.error("❌ Error finding pending purchases:", error);
        return null;
      }

      const purchase = recentPurchases?.[0] || null;

      if (purchase) {
        console.log(`✅ Found pending purchase: ${purchase.id}`);
      } else {
        console.log("ℹ️ No pending purchases found");
      }

      return purchase;
    } catch (error) {
      console.error("❌ Unexpected error in findPendingPurchase:", error);
      return null;
    }
  }

  static async updatePurchaseStatus(
    purchaseId: string,
    paymentId: string,
    status: string = "approved"
  ): Promise<{ error: PostgrestError | Error | null }> {
    try {
      const supabase = await this.getClient();

      const { error } = await supabase
        .from("credit_purchases")
        .update({
          payment_id: paymentId,
          payment_status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", purchaseId);

      return { error };
    } catch (error) {
      console.error("❌ Error in updatePurchaseStatus:", error);
      return { error: error as Error };
    }
  }

  static async applyPurchaseCredits(purchaseId: string): Promise<{
    data: ApplyCreditResult | null;
    error: PostgrestError | Error | null;
  }> {
    try {
      const supabase = await this.getClient();

      const result = await supabase.rpc("apply_credit_purchase_secure", {
        p_purchase_id: purchaseId,
      });

      // La nueva función retorna un objeto JSONB directamente
      return {
        data: result.data as ApplyCreditResult | null,
        error: result.error,
      };
    } catch (error) {
      console.error("❌ Error in applyPurchaseCredits:", error);
      return { data: null, error: error as Error };
    }
  }

  /**
   * Busca una compra específica por ID (para producción)
   */
  static async findPurchaseById(
    purchaseId: string
  ): Promise<CreditPurchase | null> {
    try {
      const supabase = await this.getClient();

      const { data: purchase, error } = await supabase
        .from("credit_purchases")
        .select("*")
        .eq("id", purchaseId)
        .single();

      if (error) {
        console.error(`❌ Error finding purchase ${purchaseId}:`, error);
        return null;
      }

      return purchase;
    } catch (error) {
      console.error("❌ Unexpected error in findPurchaseById:", error);
      return null;
    }
  }

  /**
   * Encuentra compras pendientes de un usuario específico
   */
  static async findPendingPurchasesByUser(
    userId: string,
    limit: number = 10
  ): Promise<CreditPurchase[]> {
    try {
      const supabase = await this.getClient();

      const { data: purchases, error } = await supabase
        .from("credit_purchases")
        .select("*")
        .eq("user_id", userId)
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error(
          `❌ Error finding pending purchases for user ${userId}:`,
          error
        );
        return [];
      }

      return purchases || [];
    } catch (error) {
      console.error(
        "❌ Unexpected error in findPendingPurchasesByUser:",
        error
      );
      return [];
    }
  }

  /**
   * Obtiene el balance actual de un usuario
   */
  static async getUserBalance(userId: string): Promise<number | null> {
    try {
      const supabase = await this.getClient();

      const { data: profile, error } = await supabase
        .from("user_profiles")
        .select("credits_balance")
        .eq("id", userId)
        .single();

      if (error) {
        console.error(`❌ Error getting balance for user ${userId}:`, error);
        return null;
      }

      return profile?.credits_balance || 0;
    } catch (error) {
      console.error("❌ Unexpected error in getUserBalance:", error);
      return null;
    }
  }

  /**
   * Log de webhooks para auditoría de seguridad
   */
  static async logWebhook(
    paymentId: string | null,
    eventType: string,
    payload: unknown,
    signature: string | null,
    isValid: boolean,
    errorMessage?: string
  ): Promise<void> {
    try {
      const supabase = await this.getClient();

      await supabase.from("mercadopago_webhook_logs").insert({
        payment_id: paymentId?.substring(0, 100),
        event_type: eventType?.substring(0, 50),
        payload: this.sanitizePayload(payload),
        signature: signature?.substring(0, 500),
        is_valid: isValid,
        error_message: errorMessage?.substring(0, 1000),
        processed: isValid && !errorMessage,
        received_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("❌ Failed to log webhook:", error);
    }
  }

  /**
   * Sanitiza el payload para prevenir inyecciones
   */
  private static sanitizePayload(payload: unknown): unknown {
    if (!payload || typeof payload !== "object") return payload;

    try {
      return structuredClone(payload);
    } catch {
      return { error: "Invalid payload structure" };
    }
  }
}
