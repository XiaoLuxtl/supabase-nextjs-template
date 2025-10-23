// src/app/api/payments/process-payment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser, validateResourceOwnership } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";

// Type definitions
interface ProcessPaymentRequest {
  payment_id: string;
  external_reference: string;
  user_id?: string; // Optional for webhook calls
}

interface CreditPurchase {
  id: string;
  user_id: string;
  package_id: string;
  package_name: string;
  credits_amount: number;
  price_paid_mxn: number;
  payment_method: string;
  payment_status: string;
  payment_id?: string;
  applied_at?: string;
  preference_id?: string;
}

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const paymentClient = new Payment(client);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

// Helper function to validate request and ownership
async function validatePaymentRequest(
  request: NextRequest,
  body: ProcessPaymentRequest
): Promise<
  NextResponse | { authenticatedUserId: string; isWebhookCall: boolean }
> {
  const { payment_id, external_reference, user_id } = body;

  // Check if this is a webhook call (no user auth) or user-initiated call
  const authResult = await authenticateUser(request);

  // If user is authenticated, validate ownership
  if (authResult.success && authResult.user) {
    const authenticatedUserId = authResult.user.id;

    // If user_id provided in body, validate it matches authenticated user
    if (user_id && !validateResourceOwnership(authenticatedUserId, user_id)) {
      logger.warn("User attempted to process payment for different user", {
        authenticatedUserId,
        requestedUserId: user_id,
        paymentId: payment_id,
        externalReference: external_reference,
        ip:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
      });
      return NextResponse.json(
        { error: "Forbidden: Cannot process payments for other users" },
        { status: 403 }
      );
    }

    // Get purchase to validate ownership
    const { data: purchase, error: purchaseError } = await supabase
      .from("credit_purchases")
      .select("user_id")
      .eq("id", external_reference)
      .single();

    if (purchaseError || !purchase) {
      logger.warn("Purchase not found during ownership validation", {
        purchaseId: external_reference,
        userId: authenticatedUserId,
      });
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    if (!validateResourceOwnership(authenticatedUserId, purchase.user_id)) {
      logger.warn(
        "User attempted to process payment for purchase belonging to different user",
        {
          authenticatedUserId,
          purchaseUserId: purchase.user_id,
          purchaseId: external_reference,
          paymentId: payment_id,
          ip:
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown",
        }
      );
      return NextResponse.json(
        { error: "Forbidden: This payment does not belong to you" },
        { status: 403 }
      );
    }

    return { authenticatedUserId, isWebhookCall: false };
  }

  // For webhook calls (no authentication), we still validate the purchase exists
  // but don't enforce ownership since webhooks come from MercadoPago
  const { data: purchase, error: purchaseError } = await supabase
    .from("credit_purchases")
    .select("user_id")
    .eq("id", external_reference)
    .single();

  if (purchaseError || !purchase) {
    logger.warn("Purchase not found in webhook call", {
      purchaseId: external_reference,
      paymentId: payment_id,
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        "unknown",
    });
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  logger.info("Processing webhook payment", {
    purchaseId: external_reference,
    paymentId: payment_id,
    purchaseUserId: purchase.user_id,
    ip:
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown",
  });

  return { authenticatedUserId: purchase.user_id, isWebhookCall: true };
}

// Main processing logic
async function processPaymentLogic(
  request: NextRequest,
  body: ProcessPaymentRequest
) {
  const { payment_id, external_reference } = body;

  // 🔐 VALIDACIÓN DE AUTENTICACIÓN Y PROPIEDAD
  const validationResult = await validatePaymentRequest(request, body);
  if (validationResult instanceof NextResponse) {
    return validationResult;
  }

  // 1️⃣ Verificar que la compra existe
  const { data: purchase, error: purchaseError } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("id", external_reference)
    .single();

  if (purchaseError || !purchase) {
    logger.error("Purchase not found", {
      purchaseId: external_reference,
      paymentId: payment_id,
      error: purchaseError?.message,
    });
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  // 2️⃣ Si ya se aplicó, retornar éxito inmediatamente
  if (purchase.applied_at) {
    logger.info("Credits already applied for purchase", {
      purchaseId: purchase.id,
      appliedAt: purchase.applied_at,
    });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("credits_balance")
      .eq("id", purchase.user_id)
      .single();

    return NextResponse.json({
      success: true,
      already_applied: true,
      status: purchase.payment_status,
      new_balance: profile?.credits_balance || 0,
    });
  }

  // 3️⃣ Obtener el pago de Mercado Pago
  const { payment, usedFallback } = await getMercadoPagoPayment(
    payment_id,
    external_reference
  );

  // 4️⃣ Verificar que el external_reference coincide
  if (!usedFallback && payment.external_reference !== external_reference) {
    logger.error("External reference mismatch", {
      expected: external_reference,
      received: payment.external_reference,
      paymentId: payment_id,
    });
    return NextResponse.json(
      { error: "External reference mismatch" },
      { status: 400 }
    );
  }

  // 5️⃣ Mapear estado
  let newStatus = "pending";
  if (payment.status === "approved") {
    newStatus = "approved";
  } else if (payment.status === "rejected") {
    newStatus = "rejected";
  } else if (payment.status === "cancelled") {
    newStatus = "cancelled";
  }

  // 6️⃣ Actualizar estado en la base de datos
  const { error: updateError } = await supabase
    .from("credit_purchases")
    .update({
      payment_id: payment.id?.toString(),
      payment_status: newStatus,
    })
    .eq("id", external_reference);

  if (updateError) {
    logger.error("Error updating purchase status", {
      purchaseId: external_reference,
      paymentId: payment_id,
      newStatus,
      error: updateError,
    });
    return NextResponse.json(
      { error: "Failed to update purchase" },
      { status: 500 }
    );
  }

  // 7️⃣ Aplicar créditos si fue aprobado
  return applyCreditsIfApproved(
    external_reference,
    payment_id,
    newStatus,
    purchase,
    usedFallback,
    validationResult.isWebhookCall // ← Pasar este valor
  );
}

// Helper function to get payment from MercadoPago
async function getMercadoPagoPayment(
  payment_id: string,
  external_reference: string
) {
  let payment;
  let usedFallback = false;

  try {
    logger.info("Fetching payment from Mercado Pago", {
      paymentId: payment_id,
    });
    payment = await paymentClient.get({ id: payment_id });
    logger.info("Payment fetched successfully", {
      paymentId: payment.id,
      status: payment.status,
      externalReference: payment.external_reference,
    });
  } catch (error: unknown) {
    logger.error("Failed to get payment from Mercado Pago", {
      paymentId: payment_id,
      error: (error as Error)?.message || String(error),
    });

    // 🧪 FALLBACK PARA DESARROLLO
    const isDevelopment = process.env.NODE_ENV === "development";
    const isTestCredentials =
      process.env.MERCADOPAGO_ACCESS_TOKEN?.includes("APP_USR");

    if (isDevelopment || isTestCredentials) {
      logger.warn("DEV/TEST mode: Using fallback payment approval", {
        paymentId: payment_id,
        externalReference: external_reference,
      });
      usedFallback = true;
      payment = {
        id: payment_id,
        status: "approved",
        external_reference: external_reference,
      };
    } else {
      // En producción, si el pago no existe, es retryable
      logger.warn("Payment not found in Mercado Pago (production)", {
        paymentId: payment_id,
        externalReference: external_reference,
      });
      throw new Error("PAYMENT_NOT_FOUND");
    }
  }

  return { payment, usedFallback };
}

// Helper function to apply credits
async function applyCreditsIfApproved(
  external_reference: string,
  payment_id: string,
  newStatus: string,
  purchase: CreditPurchase,
  usedFallback: boolean,
  isWebhookCall: boolean // ← Este parámetro debe estar
): Promise<NextResponse> {
  if (newStatus !== "approved") {
    logger.info("Payment not approved, skipping credit application", {
      purchaseId: external_reference,
      paymentId: payment_id,
      status: newStatus,
    });
    return NextResponse.json({
      success: true,
      status: newStatus,
      credits_applied: false,
      message:
        newStatus === "pending"
          ? "El pago está pendiente"
          : "El pago no fue aprobado",
    });
  }

  logger.info("Purchase details before RPC call", {
    purchaseId: external_reference,
    userId: purchase.user_id,
    paymentStatus: purchase.payment_status,
    appliedAt: purchase.applied_at,
    creditsAmount: purchase.credits_amount,
  });

  logger.info("Applying credits for approved payment via enhanced RPC", {
    purchaseId: external_reference,
    paymentId: payment_id,
    userId: purchase.user_id,
  });

  const { data: applyResult, error: applyError } = await supabase.rpc(
    "apply_credit_purchase_webhook", // ← CORRECTO
    { p_purchase_id: external_reference }
  );

  // Y después del RPC call, agrega:
  logger.info("Raw RPC response", {
    applyResult: applyResult,
    applyError: applyError,
  });

  if (applyError) {
    logger.error("Error applying credits via enhanced RPC", {
      purchaseId: external_reference,
      paymentId: payment_id,
      error: applyError,
    });
    throw new Error(`Failed to apply credits: ${applyError.message}`);
  }

  // Manejar la nueva estructura de respuesta
  if (applyResult && !applyResult.success) {
    logger.error("Credit application failed via enhanced RPC", {
      purchaseId: external_reference,
      error: applyResult.error,
      errorCode: applyResult.error_code,
      alreadyApplied: applyResult.already_applied,
    });

    // Si ya estaba aplicado, no es un error fatal
    if (applyResult.already_applied) {
      logger.info("Credits were already applied, continuing", {
        purchaseId: external_reference,
      });

      return NextResponse.json({
        success: true,
        status: newStatus,
        credits_applied: false,
        already_applied: true,
        new_balance: applyResult.new_balance,
        used_fallback: usedFallback,
      });
    }

    throw new Error(`Credit application failed: ${applyResult.error}`);
  }

  logger.info("Credits applied successfully via enhanced RPC", {
    purchaseId: external_reference,
    newBalance: applyResult?.new_balance,
    creditsAdded: applyResult?.credits_added,
    userId: purchase.user_id,
  });

  return NextResponse.json({
    success: true,
    status: newStatus,
    credits_applied: true,
    new_balance: applyResult?.new_balance || 0,
    credits_added: applyResult?.credits_added || 0,
    used_fallback: usedFallback,
  });
}

export async function POST(request: NextRequest) {
  let body: ProcessPaymentRequest = { payment_id: "", external_reference: "" };

  try {
    body = (await request.json()) as ProcessPaymentRequest;
    const { payment_id, external_reference } = body;

    // ✅ VALIDACIÓN DE ENTRADA BÁSICA
    if (!payment_id || !external_reference) {
      logger.warn("Missing required parameters in payment processing", {
        paymentId: payment_id,
        externalReference: external_reference,
      });
      return NextResponse.json(
        { error: "payment_id and external_reference required" },
        { status: 400 }
      );
    }

    // Delegar toda la lógica de procesamiento
    return await processPaymentLogic(request, body);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error("Process payment error", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      paymentId: body.payment_id,
      externalReference: body.external_reference,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
