import { MercadoPagoConfig, Payment, MerchantOrder } from "mercadopago";
import { createClient } from "@supabase/supabase-js";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const paymentClient = new Payment(client);
const merchantOrderClient = new MerchantOrder(client);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Función para simular procesamiento exitoso en desarrollo
async function simulateSuccessInDevelopment(
  resourceId: string,
  resourceType: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`🧪 DEV: Simulating successful ${resourceType}: ${resourceId}`);
  console.log(`🔍 DEV: Purchase ID from external_reference: ${resourceId}`);

  try {
    // Buscar por external_reference (debería ser el purchase_id)
    const { data: pendingPurchases, error } = await supabase
      .from("credit_purchases")
      .select("*")
      .eq("id", resourceId) // Buscar por ID de compra
      .eq("payment_status", "pending");

    if (error) {
      console.error("❌ Error fetching purchase:", error);
      return { success: true };
    }

    if (!pendingPurchases || pendingPurchases.length === 0) {
      console.log(
        "ℹ️ No pending purchase found with that ID, searching for any pending..."
      );

      // Buscar cualquier compra pendiente
      const { data: anyPending } = await supabase
        .from("credit_purchases")
        .select("*")
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(1);

      if (anyPending && anyPending.length > 0) {
        console.log(`🔍 Found different pending purchase: ${anyPending[0].id}`);
      } else {
        console.log("❌ No pending purchases found at all");
      }

      return { success: true };
    }

    const purchase = pendingPurchases[0];
    console.log(
      `✅ DEV: Found exact purchase: ${purchase.id} for user ${purchase.user_id}`
    );

    // Solo procesar si no está ya aplicado
    if (!purchase.applied_at) {
      // Actualizar la compra como aprobada - SIN updated_at
      const { error: updateError } = await supabase
        .from("credit_purchases")
        .update({
          payment_id: `dev_${resourceType}_${resourceId}`,
          payment_status: "approved",
          // REMOVED: updated_at: new Date().toISOString()
        })
        .eq("id", purchase.id);

      if (updateError) {
        console.error("❌ Error updating purchase:", updateError);
        return { success: true };
      }

      // Intentar aplicar créditos
      const { data: applyResult, error: applyError } = await supabase.rpc(
        "apply_credit_purchase",
        { p_purchase_id: purchase.id }
      );

      if (applyError) {
        console.error("❌ Error applying credits:", applyError);
      } else if (applyResult && !applyResult.success) {
        console.error("❌ Credit application failed:", applyResult.error);
      } else {
        console.log(
          `✅ DEV SUCCESS: Applied ${purchase.credits_amount} credits`
        );

        // Verificar que los créditos se aplicaron
        if (applyResult && applyResult.new_balance !== undefined) {
          console.log(`💰 New balance: ${applyResult.new_balance} credits`);
        }
      }
    } else {
      console.log("ℹ️ Purchase already applied, skipping");
    }

    return { success: true };
  } catch (error: any) {
    console.error("❌ Error in dev simulation:", error);
    return { success: true };
  }
}

export async function processPayment(
  paymentId: string,
  eventData?: any
): Promise<{ success: boolean; error?: string }> {
  // EN DESARROLLO: Siempre simular éxito
  if (process.env.NODE_ENV === "development") {
    return await simulateSuccessInDevelopment(paymentId, "payment");
  }

  // SOLO EN PRODUCCIÓN: Lógica real
  const maxRetries = 3;
  let payment;

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0) await sleep(2000);
      payment = await paymentClient.get({ id: paymentId });
      console.log(`✅ Real payment ${paymentId} found on attempt ${i + 1}`);
      break;
    } catch (error: any) {
      if (error.status === 404 && i < maxRetries - 1) continue;
      return {
        success: false,
        error: `Failed to get payment: ${error.message}`,
      };
    }
  }

  if (!payment) {
    return { success: false, error: "Payment not found after retries" };
  }

  const purchaseId = payment.external_reference;
  if (!purchaseId) {
    return { success: false, error: "No external_reference in payment" };
  }

  // Actualizar la compra (producción) - SIN updated_at
  const { error: updateError } = await supabase
    .from("credit_purchases")
    .update({
      payment_id: payment.id?.toString(),
      payment_status: "approved",
    })
    .eq("id", purchaseId);

  if (updateError) {
    return {
      success: false,
      error: `Failed to update purchase: ${updateError.message}`,
    };
  }

  // Aplicar créditos
  const { data: applyResult, error: applyError } = await supabase.rpc(
    "apply_credit_purchase",
    { p_purchase_id: purchaseId }
  );

  if (applyError) {
    return {
      success: false,
      error: `Failed to apply credits: ${applyError.message}`,
    };
  }

  if (applyResult && !applyResult.success) {
    return {
      success: false,
      error: `Credit application failed: ${applyResult.error}`,
    };
  }

  console.log(
    `✅ PRODUCTION SUCCESS: Applied credits for purchase ${purchaseId}`
  );
  return { success: true };
}

export async function processMerchantOrder(
  merchantOrderId: string,
  eventData?: any
): Promise<{ success: boolean; error?: string }> {
  // EN DESARROLLO: Siempre simular éxito
  if (process.env.NODE_ENV === "development") {
    return await simulateSuccessInDevelopment(
      merchantOrderId,
      "merchant_order"
    );
  }

  // SOLO EN PRODUCCIÓN: Lógica real
  try {
    const merchantOrder = await merchantOrderClient.get({ merchantOrderId });

    if (merchantOrder.payments && merchantOrder.payments.length > 0) {
      const paymentId = merchantOrder.payments[0].id?.toString();
      if (paymentId) {
        return await processPayment(paymentId, eventData);
      }
    }

    return { success: false, error: "No payments found in merchant order" };
  } catch (error: any) {
    return { success: false, error: `Merchant order error: ${error.message}` };
  }
}
