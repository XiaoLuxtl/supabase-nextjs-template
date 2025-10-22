import { NextRequest, NextResponse } from "next/server";
import { CreditsService } from "@/lib/creditsService";
import { authenticateUser, validateResourceOwnership } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";
import { createSSRClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // Autenticar usuario
    const authResult = await authenticateUser(request);
    if (!authResult.success || !authResult.user) {
      logger.warn("Unauthorized attempt to apply purchase credits", {
        error: authResult.error,
        ip:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip"),
      });
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = authResult.user.id;

    const body = await request.json();
    const { purchaseId } = body;

    // Validar entrada
    if (!purchaseId || typeof purchaseId !== "string") {
      logger.warn("Invalid purchaseId provided", {
        userId,
        purchaseId: purchaseId ? typeof purchaseId : "undefined",
      });
      return NextResponse.json(
        { error: "Valid purchaseId is required" },
        { status: 400 }
      );
    }

    // Validar formato UUID básico
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(purchaseId)) {
      logger.warn("Invalid UUID format for purchaseId", { userId, purchaseId });
      return NextResponse.json(
        { error: "Invalid purchaseId format" },
        { status: 400 }
      );
    }

    // Verificar que la compra pertenece al usuario autenticado
    const supabase = await createSSRClient();
    const { data: purchase, error: fetchError } = await supabase
      .from("credit_purchases")
      .select("user_id, applied_at, payment_status")
      .eq("id", purchaseId)
      .single();

    if (fetchError || !purchase) {
      logger.error("Purchase not found", {
        userId,
        purchaseId,
        error: fetchError,
      });
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    if (!validateResourceOwnership(userId, purchase.user_id)) {
      logger.warn("User attempted to apply purchase they don't own", {
        userId,
        purchaseId,
        purchaseOwnerId: purchase.user_id,
      });
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verificar que la compra no haya sido aplicada ya
    if (purchase.applied_at !== null) {
      logger.warn("Attempted to apply already applied purchase", {
        userId,
        purchaseId,
        appliedAt: purchase.applied_at,
      });
      return NextResponse.json(
        { error: "Purchase already applied" },
        { status: 400 }
      );
    }

    // Verificar que el pago esté aprobado
    if (purchase.payment_status !== "approved") {
      logger.warn("Attempted to apply purchase with non-approved payment", {
        userId,
        purchaseId,
        paymentStatus: purchase.payment_status,
      });
      return NextResponse.json(
        { error: "Payment not approved" },
        { status: 400 }
      );
    }

    // Aplicar compra usando el servicio
    const result = await CreditsService.applyPurchaseCredits(purchaseId);

    if (!result.success) {
      logger.error("Failed to apply purchase credits", { userId, purchaseId });
      return NextResponse.json(
        { error: "Failed to apply purchase" },
        { status: 500 }
      );
    }

    logger.info("Purchase credits applied successfully", {
      userId,
      purchaseId,
      newBalance: result.newBalance,
    });

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
    });
  } catch (error) {
    logger.error("Unexpected error in apply purchase API", {
      error,
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip"),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
