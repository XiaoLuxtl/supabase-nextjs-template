// src/app/api/payments/check-pending/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PendingPaymentChecker } from "@/lib/mercadopago/processors/pending-payment-checker";
import { authenticateUser, validateResourceOwnership } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";

export async function POST(request: NextRequest) {
  try {
    // 🔐 AUTENTICACIÓN: Verificar usuario autenticado
    const authResult = await authenticateUser(request);
    if (!authResult.success || !authResult.user) {
      logger.warn("Unauthorized pending payment check attempt", {
        error: authResult.error,
        ip:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          "unknown",
      });
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const authenticatedUserId = authResult.user.id;
    const body = await request.json();
    const { user_id } = body;

    // 🔒 VALIDACIÓN DE PROPIEDAD: El user_id debe coincidir con el usuario autenticado
    if (!validateResourceOwnership(authenticatedUserId, user_id)) {
      logger.warn(
        "User attempted to check pending payments for different user",
        {
          authenticatedUserId,
          requestedUserId: user_id,
          ip:
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            "unknown",
        }
      );
      return NextResponse.json(
        { error: "Forbidden: Cannot check payments for other users" },
        { status: 403 }
      );
    }

    // ✅ VALIDACIÓN DE ENTRADA
    if (!user_id) {
      logger.warn("Missing user_id in pending payment check", {
        authenticatedUserId,
      });
      return NextResponse.json(
        { error: "user_id es requerido" },
        { status: 400 }
      );
    }

    // Usar el PendingPaymentChecker para procesar las compras pendientes
    const result = await PendingPaymentChecker.checkUserPendingPayments(
      user_id
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Error interno del servidor",
          details: result.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      processed: result.processed,
      checked: result.checked,
      total_pending: result.total_pending,
    });
  } catch (error) {
    logger.error("Error in pending payment check endpoint", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
