import { MercadoPagoConfig, Payment } from "mercadopago";
import { SupabaseClient } from "../clients/supabase-client";
import { CreditApplier } from "./credit-applier";
import { logger } from "../../utils/logger";

interface PaymentSearchResult {
  id?: string;
  status?: string;
  status_detail?: string;
}

interface CheckResult {
  success: boolean;
  processed: number;
  checked: number;
  total_pending: number;
  message: string;
  error?: string;
}

interface PendingPurchase {
  id: string;
  user_id: string;
  preference_id?: string;
  applied_at?: string | null;
  created_at: string;
}

export class PendingPaymentChecker {
  private static readonly client = new MercadoPagoConfig({
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  });

  private static readonly paymentClient = new Payment(this.client);

  /**
   * Check and process pending payments for a specific user
   */
  static async checkUserPendingPayments(userId: string): Promise<CheckResult> {
    try {
      logger.info("Checking pending payments for user", { userId });

      // Get pending purchases (last 10)
      const pendingPurchases = await SupabaseClient.findPendingPurchasesByUser(
        userId,
        10
      );

      if (!pendingPurchases || pendingPurchases.length === 0) {
        logger.info("No pending purchases found for user", { userId });
        return {
          success: true,
          processed: 0,
          checked: 0,
          total_pending: 0,
          message: "No hay compras pendientes",
        };
      }

      logger.info("Found pending purchases for user", {
        userId,
        count: pendingPurchases.length,
      });

      let processed = 0;
      let checked = 0;

      // Process each pending purchase
      for (const purchase of pendingPurchases) {
        checked++;
        const result = await this.processSinglePurchase(
          purchase,
          checked,
          pendingPurchases.length
        );

        if (result.processed) {
          processed++;
        }
      }

      const message = `Se verificaron ${checked} compras, ${processed} fueron procesadas`;

      logger.info("Finished checking pending payments", {
        userId,
        processed,
        checked,
        totalPending: pendingPurchases.length,
      });

      return {
        success: true,
        processed,
        checked,
        total_pending: pendingPurchases.length,
        message,
      };
    } catch (error) {
      logger.error("Error checking pending payments", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        processed: 0,
        checked: 0,
        total_pending: 0,
        message: "Error interno del servidor",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process a single pending purchase
   */
  private static async processSinglePurchase(
    purchase: PendingPurchase,
    index: number,
    total: number
  ): Promise<{ processed: boolean }> {
    try {
      logger.info("Processing pending purchase", {
        purchaseId: purchase.id,
        index,
        total,
        preferenceId: purchase.preference_id,
        createdAt: purchase.created_at,
      });

      // Skip if no preference_id
      if (!purchase.preference_id) {
        logger.warn("Purchase missing preference_id, skipping", {
          purchaseId: purchase.id,
        });
        return { processed: false };
      }

      // Search for payments associated with this preference
      const payments = await this.searchPaymentsByPreference(
        purchase.preference_id
      );

      if (payments.length === 0) {
        logger.info("No payments found for preference", {
          purchaseId: purchase.id,
          preferenceId: purchase.preference_id,
        });
        return { processed: false };
      }

      // Take the most recent payment
      const payment = payments[0];
      logger.info("Found payment for purchase", {
        purchaseId: purchase.id,
        paymentId: payment.id,
        status: payment.status,
        statusDetail: payment.status_detail,
      });

      // Process based on payment status
      return await this.processPaymentStatus(purchase, payment);
    } catch (error) {
      logger.error("Error processing single purchase", {
        purchaseId: purchase.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return { processed: false };
    }
  }

  /**
   * Search payments by preference ID
   */
  private static async searchPaymentsByPreference(
    preferenceId: string
  ): Promise<PaymentSearchResult[]> {
    try {
      const paymentsResponse = await this.paymentClient.search({
        options: {
          preference_id: preferenceId,
        },
      });

      const payments = paymentsResponse.results || [];
      logger.info("Found payments for preference", {
        preferenceId,
        count: payments.length,
      });

      return payments;
    } catch (searchError) {
      logger.error("Error searching payments by preference", {
        preferenceId,
        error:
          searchError instanceof Error
            ? searchError.message
            : String(searchError),
      });

      // In development, continue despite search errors
      if (process.env.NODE_ENV === "development") {
        logger.warn("DEV mode: Continuing despite search error", {
          preferenceId,
        });
        return [];
      }

      throw searchError;
    }
  }

  /**
   * Process payment based on its status
   */
  private static async processPaymentStatus(
    purchase: PendingPurchase,
    payment: PaymentSearchResult
  ): Promise<{ processed: boolean }> {
    const { id: purchaseId } = purchase;
    const { id: paymentId, status } = payment;

    // If payment is approved and not yet applied
    if (status === "approved" && !purchase.applied_at) {
      logger.info("Payment approved, applying credits", {
        purchaseId,
        paymentId,
      });

      // Update purchase status
      const updateResult = await SupabaseClient.updatePurchaseStatus(
        purchaseId,
        paymentId || "",
        "approved"
      );
      if (updateResult.error) {
        logger.error("Error updating purchase status", {
          purchaseId,
          paymentId,
          error: updateResult.error,
        });
        return { processed: false };
      }

      // Apply credits
      const creditResult = await CreditApplier.applyCredits(purchaseId);
      if (!creditResult.success) {
        logger.error("Credit application failed", {
          purchaseId,
          error: creditResult.error,
        });
        return { processed: false };
      }

      logger.info("Credits applied successfully", { purchaseId });
      return { processed: true };
    } else if (status === "rejected" || status === "cancelled") {
      logger.info("Payment rejected or cancelled", {
        purchaseId,
        paymentId,
        status,
      });

      // Update status for rejected/cancelled payments
      await SupabaseClient.updatePurchaseStatus(
        purchaseId,
        paymentId || "",
        status
      );
      return { processed: true };
    } else if (status === "pending") {
      logger.info("Payment still pending", { purchaseId, paymentId });
      return { processed: false };
    } else if (status === "in_process") {
      logger.info("Payment in process", { purchaseId, paymentId });
      return { processed: false };
    } else {
      logger.info("Payment status", { purchaseId, paymentId, status });
      return { processed: false };
    }
  }
}
