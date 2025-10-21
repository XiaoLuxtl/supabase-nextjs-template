import { NextRequest, NextResponse } from "next/server";
import {
  parseWebhookEvent,
  logWebhookAttempt,
  buildBodyFromQueryParams,
  isValidWebhookStructure,
} from "@/lib/mercadopago/webhook-utils";
import {
  processPayment,
  processMerchantOrder,
} from "@/lib/mercadopago/payment-processor";
import { verifyMercadoPagoSignature } from "@/lib/mercadopago/signature-utils";

// Constantes para mejor mantenibilidad
const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  INTERNAL_ERROR: 500,
  SUCCESS: 200,
} as const;

const ENVIRONMENT = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
} as const;

/**
 * Procesa el webhook en background (no bloqueante)
 */
async function processInBackground(
  event: ReturnType<typeof parseWebhookEvent>
): Promise<void> {
  try {
    console.log("🔧 Background processing:", event.type, event.resourceId);

    let processResult;
    if (event.type === "payment") {
      processResult = await processPayment(event.resourceId);
    } else if (event.type === "merchant_order") {
      processResult = await processMerchantOrder(event.resourceId);
    }

    if (processResult && !processResult.success) {
      console.log(
        "⚠️ Background processing failed (but we already returned 200):",
        processResult.error
      );
    } else {
      console.log("✅ Background processing completed");
    }
  } catch (error) {
    console.error("❌ Background processing error (non-critical):", error);
  }
}

/**
 * Maneja el modo desarrollo - siempre retorna éxito
 */
async function handleDevelopmentMode(
  rawBody: string,
  signature: string | null,
  requestUrl: string
): Promise<NextResponse> {
  console.log("🧪 DEV MODE: Returning immediate success");

  try {
    const body = parseRequestBody(rawBody, requestUrl);
    const event = parseWebhookEvent(body);

    await logWebhookAttempt(
      event.resourceId,
      event.type,
      { ...(event.data as object), dev_mode: true }, // Cast seguro para spread
      signature,
      true,
      "DEV MODE: Immediate success"
    );

    // Procesar en background sin esperar
    processInBackground(event).catch(console.error);

    return NextResponse.json({
      received: true,
      environment: ENVIRONMENT.DEVELOPMENT,
      message: "Webhook accepted in development mode",
      event_type: event.type,
      resource_id: event.resourceId,
    });
  } catch (error) {
    console.error("❌ Error in dev mode, but returning 200:", error);
    return NextResponse.json({
      received: true,
      environment: ENVIRONMENT.DEVELOPMENT,
      error: "Error but returning success to avoid retries",
    });
  }
}

/**
 * Parsea el body de la request de forma segura
 */
function parseRequestBody(rawBody: string, requestUrl: string): unknown {
  if (rawBody) {
    try {
      return JSON.parse(rawBody);
    } catch (parseError) {
      console.error("❌ Error parsing JSON:", parseError);
    }
  }

  // Si no hay body o falló el parse, construir desde query params
  if (requestUrl.includes("?")) {
    const constructedBody = buildBodyFromQueryParams(requestUrl);
    if (constructedBody) {
      try {
        return JSON.parse(constructedBody);
      } catch (e) {
        console.error("❌ Error parsing constructed body:", e);
      }
    }
  }

  return {
    url: requestUrl,
    rawBody: rawBody.substring(0, 200),
  };
}

/**
 * Maneja la validación de firma en producción
 */
async function handleProductionValidation(
  rawBody: string,
  signature: string | null,
  requestUrl: string
): Promise<NextResponse | null> {
  const signatureResult = verifyMercadoPagoSignature(rawBody, signature);

  if (!signatureResult.isValid) {
    console.error("❌ Invalid signature:", signatureResult.error);
    await logWebhookAttempt(
      null,
      "invalid_signature",
      { rawBody, url: requestUrl },
      signature,
      false,
      signatureResult.error
    );
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: HTTP_STATUS.UNAUTHORIZED }
    );
  }

  console.log("✅ Signature valid");
  return null; // No error, continuar procesamiento
}

/**
 * Procesa el evento del webhook
 */
async function processWebhookEvent(
  body: unknown,
  signature: string | null,
  requestUrl: string
): Promise<NextResponse> {
  // Validar estructura básica
  if (!isValidWebhookStructure(body)) {
    return NextResponse.json(
      { error: "Invalid webhook structure" },
      { status: HTTP_STATUS.BAD_REQUEST }
    );
  }

  const event = parseWebhookEvent(body);
  console.log(`🔍 Event type: ${event.type}, Resource: ${event.resourceId}`);

  await logWebhookAttempt(
    event.resourceId,
    event.type,
    { ...(event.data as object), originalUrl: requestUrl }, // Cast seguro
    signature,
    true
  );

  // Procesar según tipo (sincrónico en producción)
  let processResult;
  if (event.type === "payment") {
    processResult = await processPayment(event.resourceId);
  } else if (event.type === "merchant_order") {
    processResult = await processMerchantOrder(event.resourceId);
  } else {
    console.log("⚠️ Unsupported event type");
    return NextResponse.json({
      received: true,
      event_type: event.type,
      message: "Event type not processed but acknowledged",
    });
  }

  if (!processResult.success) {
    console.error("❌ Processing failed:", processResult.error);
    return NextResponse.json(
      { error: processResult.error },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }

  return NextResponse.json({
    received: true,
    event_type: event.type,
    resource_id: event.resourceId,
    processed: true,
  });
}

/**
 * Handler principal del webhook
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  console.log("🎣 WEBHOOK RECEIVED");
  console.log("📋 URL:", request.url);
  console.log("🌐 Environment:", process.env.NODE_ENV);

  const signature = request.headers.get("x-signature");
  const rawBody = await request.text();

  // EN DESARROLLO: Retornar éxito inmediatamente
  if (process.env.NODE_ENV === ENVIRONMENT.DEVELOPMENT) {
    return handleDevelopmentMode(rawBody, signature, request.url);
  }

  // PRODUCCIÓN: Validación estricta
  const validationError = await handleProductionValidation(
    rawBody,
    signature,
    request.url
  );
  if (validationError) return validationError;

  try {
    const body = parseRequestBody(rawBody, request.url);
    return await processWebhookEvent(body, signature, request.url);
  } catch (error) {
    console.error("❌ Webhook processing error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await logWebhookAttempt(
      null,
      "processing_error",
      {
        rawBody: rawBody.substring(0, 500),
        url: request.url,
        error: errorMessage,
      },
      signature,
      false,
      errorMessage
    );

    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS.INTERNAL_ERROR }
    );
  }
}

/**
 * Endpoint GET para verificación
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "ok",
    webhook_security:
      process.env.NODE_ENV === ENVIRONMENT.PRODUCTION
        ? "enabled"
        : "development_mode",
    environment: process.env.NODE_ENV,
    note:
      process.env.NODE_ENV === ENVIRONMENT.DEVELOPMENT
        ? "In development: always returns 200 to avoid retries"
        : "In production: strict validation enabled",
  });
}
