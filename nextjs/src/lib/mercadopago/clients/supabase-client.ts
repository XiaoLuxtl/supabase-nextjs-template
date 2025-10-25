// clients/supabase-client.ts
import { createClient } from "@supabase/supabase-js";
import { CreditPurchase, ApplyCreditResult } from "../types";
import type { PostgrestError } from "@supabase/supabase-js";

/**
 * CLIENTE SEGURO - Solo usa Service Role para operaciones internas
 */
class SecureSupabaseClient {
  private static readonly client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.PRIVATE_SUPABASE_SERVICE_KEY!
  );

  /**
   * Para operaciones que necesitan RLS (usuarios) - usar createServerClient
   * Pero para logs internos usamos siempre service_role
   */
  static getClient() {
    return this.client;
  }
}

export class SupabaseClient {
  /**
   * Obtiene cliente seguro (service_role) para operaciones internas
   */
  private static getSecureClient() {
    return SecureSupabaseClient.getClient();
  }

  static async findPendingPurchase(): Promise<CreditPurchase | null> {
    try {
      const supabase = this.getSecureClient();

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
      const supabase = this.getSecureClient();

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
      const supabase = this.getSecureClient();

      // ✅ Usar la nueva función v2 que maneja service_role
      const result = await supabase.rpc("apply_credit_purchase_secure_v2", {
        p_purchase_id: purchaseId,
      });

      return {
        data: result.data as ApplyCreditResult | null,
        error: result.error,
      };
    } catch (error) {
      console.error("❌ Error in applyPurchaseCredits:", error);
      return { data: null, error: error as Error };
    }
  }

  static async findPurchaseById(
    purchaseId: string
  ): Promise<CreditPurchase | null> {
    try {
      const supabase = this.getSecureClient();

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

  static async findPendingPurchasesByUser(
    userId: string,
    limit: number = 10
  ): Promise<CreditPurchase[]> {
    try {
      const supabase = this.getSecureClient();

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

  static async getUserBalance(userId: string): Promise<number | null> {
    try {
      const supabase = this.getSecureClient();

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
   * 🔒 LOG SEGURO - Solo service_role puede acceder ahora
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
      const supabase = this.getSecureClient();

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

      console.log(`✅ Webhook logged securely for ${eventType}: ${paymentId}`);
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
      return JSON.parse(JSON.stringify(payload)); // Deep clone seguro
    } catch {
      return { error: "Invalid payload structure" };
    }
  }
}
