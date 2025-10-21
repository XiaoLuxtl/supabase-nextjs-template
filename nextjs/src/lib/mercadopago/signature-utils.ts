import crypto from "crypto";

export interface SignatureVerificationResult {
  isValid: boolean;
  timestamp?: string;
  error?: string;
}

export function verifyMercadoPagoSignature(
  body: string,
  signature: string | null
): SignatureVerificationResult {
  console.log("🔍 DEBUG Signature Verification:", {
    signature,
    bodyLength: body.length,
    bodyPreview: body.substring(0, 100),
    hasSecret: !!process.env.MERCADOPAGO_WEBHOOK_SECRET,
    secretLength: process.env.MERCADOPAGO_WEBHOOK_SECRET?.length,
    secretPreview:
      process.env.MERCADOPAGO_WEBHOOK_SECRET?.substring(0, 10) + "...",
  });

  console.log("🔐 SECRET DEBUG:", {
    secret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
    secretStartsWith: process.env.MERCADOPAGO_WEBHOOK_SECRET?.substring(0, 20),
    secretEndsWith: process.env.MERCADOPAGO_WEBHOOK_SECRET?.substring(44),
  });

  if (!signature) {
    return { isValid: false, error: "No signature provided" };
  }

  if (!process.env.MERCADOPAGO_WEBHOOK_SECRET) {
    const allowInDev = process.env.NODE_ENV === "development";
    return {
      isValid: allowInDev,
      error: allowInDev
        ? "Allowed in development"
        : "Webhook secret not configured",
    };
  }

  try {
    const parts = signature.split(",");
    const tsPart = parts.find((part) => part.startsWith("ts="));
    const v1Part = parts.find((part) => part.startsWith("v1="));

    console.log("🔍 DEBUG Signature Parts:", { parts, tsPart, v1Part });

    if (!tsPart || !v1Part) {
      return { isValid: false, error: "Invalid signature format" };
    }

    const timestamp = tsPart.split("=")[1];
    const receivedSignature = v1Part.split("=")[1];
    const payload = `${timestamp}.${body}`;

    console.log("🔍 DEBUG Payload for HMAC:", {
      timestamp,
      payloadLength: payload.length,
      payloadPreview: payload.substring(0, 100),
    });

    const digest = crypto
      .createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");

    const isValid = digest === receivedSignature;

    console.log("🔍 DEBUG HMAC Comparison:", {
      receivedSignature: receivedSignature.substring(0, 20) + "...",
      calculatedDigest: digest.substring(0, 20) + "...",
      isValid,
    });

    return {
      isValid,
      timestamp,
      ...(isValid ? {} : { error: "Signature mismatch" }),
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Verification error: ${
        error instanceof Error ? error.message : "Unknown"
      }`,
    };
  }
}
