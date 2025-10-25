// development-processor.ts - VERSIÓN MEJORADA
import { SupabaseClient } from "../clients/supabase-client";
import { CreditApplier } from "./credit-applier";
import { ProcessResult, ResourceType } from "../types";

export class DevelopmentProcessor {
  private static lastProcessedPurchaseId: string | null = null;

  static async process(
    resourceId: string,
    resourceType: ResourceType
  ): Promise<ProcessResult> {
    console.log(`🧪 DEV: Processing ${resourceType} with ID: ${resourceId}`);

    try {
      // ✅ SOLUCIÓN: Prevenir doble procesamiento de la MISMA compra
      if (this.lastProcessedPurchaseId) {
        console.log(
          `🔄 DEV: Checking if purchase ${this.lastProcessedPurchaseId} was already processed`
        );
        const existingPurchase = await SupabaseClient.findPurchaseById(
          this.lastProcessedPurchaseId
        );
        if (existingPurchase?.applied_at) {
          console.log("ℹ️ DEV: Last purchase already applied, finding new one");
          this.lastProcessedPurchaseId = null;
        }
      }

      // Buscar compra pendiente
      const testUserId = "8f929b80-ab86-4705-8171-b0d60f02547f";
      const pendingPurchases = await SupabaseClient.findPendingPurchasesByUser(
        testUserId,
        5
      );

      // Encontrar una compra NO procesada
      const pendingPurchase =
        pendingPurchases.find((p) => !p.applied_at) || null;

      if (!pendingPurchase) {
        console.log("ℹ️ No unapplied pending purchases found (dev mode)");
        return { success: true };
      }

      // ✅ BLOQUEAR: Si esta compra ya está siendo procesada, saltar
      if (this.lastProcessedPurchaseId === pendingPurchase.id) {
        console.log(
          `🔄 DEV: Purchase ${pendingPurchase.id} is already being processed, skipping`
        );
        return { success: true };
      }

      this.lastProcessedPurchaseId = pendingPurchase.id;

      console.log(`✅ DEV: Processing purchase: ${pendingPurchase.id}`);

      // Solo procesar si no está aplicada
      if (pendingPurchase.applied_at) {
        console.log("ℹ️ Purchase already applied, skipping");
        this.lastProcessedPurchaseId = null;
        return { success: true };
      }

      // Actualizar estado
      const { error: updateError } = await SupabaseClient.updatePurchaseStatus(
        pendingPurchase.id,
        `dev_${resourceType}_${resourceId}`,
        "approved"
      );

      if (updateError) {
        console.error("❌ Error updating purchase:", updateError);
        this.lastProcessedPurchaseId = null;
        return { success: true };
      }

      // Aplicar créditos
      const creditResult = await CreditApplier.applyCredits(pendingPurchase.id);
      if (!creditResult.success) {
        console.error("❌ Credit application failed:", creditResult.error);
        this.lastProcessedPurchaseId = null;
      } else {
        console.log(
          `💰 DEV SUCCESS: Applied ${pendingPurchase.credits_amount} credits`
        );
      }

      return { success: true };
    } catch (error) {
      console.error("❌ Unexpected error in development simulation:", error);
      this.lastProcessedPurchaseId = null;
      return { success: true };
    }
  }

  static isMercadoPagoId(resourceId: string): boolean {
    return /^\d+$/.test(resourceId) && resourceId.length >= 6;
  }
}
