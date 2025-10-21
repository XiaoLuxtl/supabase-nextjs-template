import { SupabaseClient } from "../clients/supabase-client";
import { CreditApplier } from "./credit-applier";
import { ProcessResult, ResourceType } from "../types";

export class DevelopmentProcessor {
  static async process(
    resourceId: string,
    resourceType: ResourceType
  ): Promise<ProcessResult> {
    console.log(`🧪 DEV: Processing ${resourceType} with ID: ${resourceId}`);

    try {
      const pendingPurchase = await SupabaseClient.findPendingPurchase();

      if (!pendingPurchase) {
        console.log("ℹ️ No pending purchases found (dev mode)");
        return { success: true };
      }

      console.log(`✅ DEV: Processing purchase: ${pendingPurchase.id}`);

      if (pendingPurchase.applied_at) {
        console.log("ℹ️ Purchase already applied, skipping");
        return { success: true };
      }

      // Update purchase
      const { error: updateError } = await SupabaseClient.updatePurchaseStatus(
        pendingPurchase.id,
        `dev_${resourceType}_${resourceId}`
      );

      if (updateError) {
        console.error("❌ Error updating purchase:", updateError);
        return { success: true };
      }

      // Apply credits
      const creditResult = await CreditApplier.applyCredits(pendingPurchase.id);
      if (!creditResult.success) {
        console.error("❌ Credit application failed:", creditResult.error);
      } else {
        console.log(
          `💰 DEV SUCCESS: Applied ${pendingPurchase.credits_amount} credits`
        );
      }

      return { success: true };
    } catch (error) {
      console.error("❌ Unexpected error in development simulation:", error);
      return { success: true };
    }
  }

  static isMercadoPagoId(resourceId: string): boolean {
    return /^\d+$/.test(resourceId) && resourceId.length >= 6;
  }
}
