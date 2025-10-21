import { SupabaseClient } from "../clients/supabase-client";
import { ApplyCreditResult } from "../types";

export class CreditApplier {
  static async applyCredits(
    purchaseId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: applyResult, error: applyError } =
        await SupabaseClient.applyPurchaseCredits(purchaseId);

      if (applyError) {
        console.error("❌ Database error applying credits:", applyError);
        return {
          success: false,
          error: `Database error: ${applyError.message}`,
        };
      }

      if (applyResult && !applyResult.success) {
        if (applyResult.already_applied) {
          console.log(`ℹ️ Credits already applied to purchase ${purchaseId}`);
          return { success: true };
        }

        console.error("❌ Credit application failed:", applyResult.error);
        return {
          success: false,
          error: applyResult.error || "Unknown credit application error",
        };
      }

      console.log(`✅ Credits applied successfully to purchase ${purchaseId}`);

      if (applyResult?.new_balance !== undefined) {
        console.log(`💰 New balance: ${applyResult.new_balance} credits`);
      }

      return { success: true };
    } catch (error) {
      console.error("❌ Unexpected error applying credits:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}
