import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

interface ApiError extends Error {
  status?: number;
  code?: string;
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const paymentClient = new Payment(client);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

// Utility function for sleep
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Validar firma del webhook
function verifyWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  if (!signature) {
    console.warn("❌ No webhook signature provided");
    return false;
  }

  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    console.warn("⚠️ MERCADOPAGO_WEBHOOK_SECRET not configured");
    // En desarrollo, permitir sin secret para testing
    return process.env.NODE_ENV === "development";
  }

  try {
    const digest = crypto
      .createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    const expectedSignature = `sha256=${digest}`;
    const isValid = expectedSignature === signature;

    console.log("🔐 Webhook signature verification:", {
      received: signature.substring(0, 20) + "...",
      expected: expectedSignature.substring(0, 20) + "...",
      isValid,
    });

    return isValid;
  } catch (error) {
    console.error("❌ Error verifying webhook signature:", error);
    return false;
  }
}

// Log webhook attempt
async function logWebhookAttempt(
  paymentId: string | null,
  eventType: string,
  payload: any,
  signature: string | null,
  isValid: boolean,
  errorMessage?: string
) {
  try {
    await supabase.from("mercadopago_webhook_logs").insert({
      payment_id: paymentId,
      event_type: eventType,
      payload: payload,
      signature: signature,
      is_valid: isValid,
      error_message: errorMessage,
      processed: isValid && !errorMessage,
    });
  } catch (logError) {
    console.error("❌ Failed to log webhook attempt:", logError);
  }
}

// Procesar el pago de forma asíncrona
async function processPaymentAsync(paymentId: string) {
  const maxRetries = 10;
  let payment;

  // Intentar obtener el pago con reintentos
  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0) {
        await sleep(2000); // 2 segundos entre intentos
        console.log(
          `[Async] Retry ${i + 1}/${maxRetries} for payment ${paymentId}`
        );
      }

      payment = await paymentClient.get({ id: paymentId });
      console.log(`[Async] Payment ${paymentId} found on attempt ${i + 1}`);
      break;
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 404 && i < maxRetries - 1) {
        continue;
      }

      console.error(`[Async] Failed to get payment ${paymentId}:`, apiError);
      return;
    }
  }

  if (!payment) {
    console.error(
      `[Async] Payment ${paymentId} not found after ${maxRetries} retries`
    );
    return;
  }

  console.log("[Async] Payment details:", {
    id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
    external_reference: payment.external_reference,
    transaction_amount: payment.transaction_amount,
  });

  const purchaseId = payment.external_reference;
  if (!purchaseId) {
    console.error("[Async] No external_reference in payment");
    return;
  }

  // Obtener la compra
  const { data: purchase, error: purchaseError } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("id", purchaseId)
    .single();

  if (purchaseError || !purchase) {
    console.error("[Async] Purchase not found:", purchaseId);
    return;
  }

  // Mapear estados
  let newStatus = "pending";
  if (payment.status === "approved") {
    newStatus = "approved";
  } else if (payment.status === "rejected") {
    newStatus = "rejected";
  } else if (payment.status === "cancelled") {
    newStatus = "cancelled";
  } else if (payment.status === "refunded") {
    newStatus = "refunded";
  }

  console.log("[Async] Updating purchase status:", {
    purchaseId,
    oldStatus: purchase.payment_status,
    newStatus,
  });

  // Actualizar estado
  const { error: updateError } = await supabase
    .from("credit_purchases")
    .update({
      payment_id: payment.id?.toString(),
      payment_status: newStatus,
    })
    .eq("id", purchaseId);

  if (updateError) {
    console.error("[Async] Error updating purchase:", updateError);
    return;
  }

  // Acreditar créditos si fue aprobado - CORREGIDO
  if (newStatus === "approved" && !purchase.applied_at) {
    console.log("[Async] Applying credits for purchase:", purchaseId);

    // LLAMADA CORREGIDA - maneja respuesta JSONB
    const { data: applyResult, error: applyError } = await supabase.rpc(
      "apply_credit_purchase",
      {
        p_purchase_id: purchaseId,
      }
    );

    if (applyError) {
      console.error("[Async] Error applying credits:", applyError);
    } else if (applyResult && !applyResult.success) {
      console.error("[Async] Credit application failed:", applyResult.error);
    } else {
      console.log("[Async] ✓ Credits applied successfully!", {
        new_balance: applyResult?.new_balance,
        credits_added: applyResult?.credits_added,
      });
    }
  }
}

export async function POST(request: NextRequest) {
  console.log("🎣 WEBHOOK RECEIVED!");
  console.log("🌐 Environment:", process.env.NODE_ENV);

  const signature = request.headers.get("x-signature");
  console.log(
    "🔐 Received signature:",
    signature ? signature.substring(0, 50) + "..." : "None"
  );

  const rawBody = await request.text();
  console.log("📨 Raw body length:", rawBody.length);

  // Validar firma del webhook
  const isValidSignature = verifyWebhookSignature(rawBody, signature);

  if (!isValidSignature) {
    console.error("❌ INVALID WEBHOOK SIGNATURE - POSSIBLE ATTACK");

    // Log del intento fallido
    await logWebhookAttempt(
      null,
      "payment",
      { raw_body: rawBody.substring(0, 500) + "..." },
      signature,
      false,
      "Invalid webhook signature"
    );

    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.log("✅ Webhook signature validated successfully");

  try {
    let data;
    try {
      data = JSON.parse(rawBody);
      console.log("📋 Webhook event type:", data.type);
      console.log("💰 Payment ID:", data.data?.id);
    } catch (parseError) {
      console.error("❌ Error parsing webhook body:", parseError);

      await logWebhookAttempt(
        null,
        "invalid_json",
        { raw_body: rawBody.substring(0, 500) + "..." },
        signature,
        false,
        "Invalid JSON in webhook body"
      );

      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { type, data: webhookData } = data;

    if (type !== "payment") {
      console.log("ℹ️ Ignoring non-payment webhook type:", type);

      await logWebhookAttempt(
        webhookData?.id,
        type,
        data,
        signature,
        true,
        `Ignored non-payment type: ${type}`
      );

      return NextResponse.json({ received: true });
    }

    const paymentId = webhookData?.id;
    if (!paymentId) {
      console.error("❌ No payment ID in webhook data");

      await logWebhookAttempt(
        null,
        "payment",
        data,
        signature,
        false,
        "No payment ID in webhook data"
      );

      return NextResponse.json({ error: "No payment ID" }, { status: 400 });
    }

    console.log("💰 Processing payment webhook for ID:", paymentId);

    // Log webhook válido
    await logWebhookAttempt(
      paymentId,
      "payment",
      {
        type: type,
        payment_id: paymentId,
        external_reference: data.data?.external_reference,
      },
      signature,
      true
    );

    // Procesar el pago de forma asíncrona
    processPaymentAsync(paymentId).catch((error) => {
      console.error("❌ Error in async payment processing:", error);
    });

    return NextResponse.json({
      received: true,
      payment_id: paymentId,
      processing: "async",
      signature_valid: true,
    });
  } catch (error) {
    console.error("❌ Webhook processing error:", error);

    await logWebhookAttempt(
      null,
      "payment",
      { raw_body: rawBody.substring(0, 500) + "..." },
      signature,
      false,
      `Processing error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );

    return NextResponse.json({
      received: true,
      error: "Internal error",
      signature_valid: true,
    });
  }
}

// GET para verificación de Mercado Pago
export async function GET() {
  return NextResponse.json({
    status: "ok",
    webhook_security: "enabled",
    environment: process.env.NODE_ENV,
  });
}
