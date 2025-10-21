// Crea: /app/api/payments/test-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  return NextResponse.json({
    webhook_secret_configured: !!secret,
    secret_length: secret?.length || 0,
    environment: process.env.NODE_ENV,
    note: secret
      ? "✅ Webhook secret is configured"
      : "❌ Webhook secret is missing",
  });
}
