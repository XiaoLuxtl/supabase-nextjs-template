// src/app/api/credits/apply-purchase/route.ts - VERSIÓN MEJORADA

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateUser, validateResourceOwnership } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";

// ✅ USAR SERVICE KEY PARA RPC DIRECTA
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

interface ApplyPurchaseRequest {
  purchaseId: string;
}

/**
 * Valida que la compra exista y pertenezca al usuario autenticado
 */
async function validatePurchaseOwnership(
  purchaseId: string,
  authenticatedUserId: string
): Promise<{ success: boolean; error?: string; purchase?: any }> {
  // Validar formato UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(purchaseId)) {
    return {
      success: false,
      error: "Invalid purchase ID format",
    };
  }

  // Obtener la compra
  const { data: purchase, error } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("id", purchaseId)
    .single();

  if (error || !purchase) {
    logger.warn("Purchase not found during validation", {
      purchaseId,
      userId: authenticatedUserId,
      error: error?.message,
    });
    return {
      success: false,
      error: "Purchase not found",
    };
  }

  // Validar propiedad
  if (!validateResourceOwnership(authenticatedUserId, purchase.user_id)) {
    logger.warn(
      "User attempted to apply purchase belonging to different user",
      {
        authenticatedUserId,
        purchaseUserId: purchase.user_id,
        purchaseId,
      }
    );
    return {
      success: false,
      error: "This purchase does not belong to you",
    };
  }

  return { success: true, purchase };
}

/**
 * Valida el estado de la compra
 */
function validatePurchaseStatus(purchase: any): {
  success: boolean;
  error?: string;
} {
  // Verificar que esté aprobada
  if (purchase.payment_status !== "approved") {
    return {
      success: false,
      error: `Purchase not approved. Current status: ${purchase.payment_status}`,
    };
  }

  // Verificar que no esté ya aplicada
  if (purchase.applied_at) {
    return {
      success: false,
      error: "Credits already applied to this purchase",
    };
  }

  return { success: true };
}

export async function POST(request: NextRequest) {
  try {
    // 1. AUTENTICAR USUARIO
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

    const authenticatedUserId = authResult.user.id;

    // 2. VALIDAR CUERPO DE LA SOLICITUD
    const body: ApplyPurchaseRequest = await request.json();
    const { purchaseId } = body;

    if (!purchaseId || typeof purchaseId !== "string") {
      return NextResponse.json(
        { error: "Valid purchaseId is required" },
        { status: 400 }
      );
    }

    // 3. VALIDAR PROPIEDAD DE LA COMPRA
    const ownershipValidation = await validatePurchaseOwnership(
      purchaseId,
      authenticatedUserId
    );
    if (!ownershipValidation.success) {
      return NextResponse.json(
        { error: ownershipValidation.error },
        {
          status: ownershipValidation.error?.includes("not belong") ? 403 : 404,
        }
      );
    }

    const purchase = ownershipValidation.purchase!;

    // 4. VALIDAR ESTADO DE LA COMPRA
    const statusValidation = validatePurchaseStatus(purchase);
    if (!statusValidation.success) {
      return NextResponse.json(
        { error: statusValidation.error },
        { status: 400 }
      );
    }

    // 5. ✅ APLICAR CRÉDITOS MEDIANTE RPC MEJORADA
    logger.info("Applying purchase credits via enhanced RPC", {
      purchaseId,
      userId: authenticatedUserId,
      packageName: purchase.package_name,
      creditsAmount: purchase.credits_amount,
    });

    const { data: applyResult, error: applyError } = await supabase.rpc(
      "apply_credit_purchase_secure",
      { p_purchase_id: purchaseId }
    );

    if (applyError) {
      logger.error("RPC error applying purchase credits", {
        purchaseId,
        userId: authenticatedUserId,
        error: applyError,
      });
      return NextResponse.json(
        { error: "Failed to apply credits" },
        { status: 500 }
      );
    }

    // 6. MANEJAR RESULTADO DE LA RPC MEJORADA
    if (!applyResult.success) {
      // Manejar casos específicos de error
      const errorCode = applyResult.error_code;

      if (errorCode === "UNAUTHORIZED_ACCESS") {
        return NextResponse.json(
          { error: "You don't have permission to apply this purchase" },
          { status: 403 }
        );
      }

      if (errorCode === "PAYMENT_NOT_APPROVED") {
        return NextResponse.json(
          { error: "This purchase is not yet approved" },
          { status: 400 }
        );
      }

      if (errorCode === "PURCHASE_NOT_FOUND") {
        return NextResponse.json(
          { error: "Purchase not found" },
          { status: 404 }
        );
      }

      logger.error("Credit application failed via enhanced RPC", {
        purchaseId,
        userId: authenticatedUserId,
        error: applyResult.error,
        errorCode: applyResult.error_code,
      });

      return NextResponse.json(
        {
          error: applyResult.error || "Failed to apply credits",
          errorCode: applyResult.error_code,
        },
        { status: 400 }
      );
    }

    // 7. ÉXITO - YA NO NECESITAMOS OBTENER BALANCE POR SEPARADO
    logger.info("Purchase credits applied successfully via enhanced RPC", {
      purchaseId,
      userId: authenticatedUserId,
      creditsAdded: applyResult.credits_added,
      newBalance: applyResult.new_balance,
      alreadyApplied: applyResult.already_applied,
    });

    return NextResponse.json({
      success: true,
      creditsAdded: applyResult.credits_added,
      newBalance: applyResult.new_balance,
      packageName: purchase.package_name,
      appliedAt: new Date().toISOString(),
      alreadyApplied: applyResult.already_applied || false,
    });
  } catch (error) {
    logger.error("Unexpected error in apply-purchase API", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
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

// También puedes agregar GET para verificar el estado de una compra
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const authenticatedUserId = authResult.user.id;
    const { searchParams } = new URL(request.url);
    const purchaseId = searchParams.get("purchaseId");

    if (!purchaseId) {
      return NextResponse.json(
        { error: "purchaseId query parameter is required" },
        { status: 400 }
      );
    }

    // Validar propiedad
    const ownershipValidation = await validatePurchaseOwnership(
      purchaseId,
      authenticatedUserId
    );
    if (!ownershipValidation.success) {
      return NextResponse.json(
        { error: ownershipValidation.error },
        { status: 404 }
      );
    }

    const purchase = ownershipValidation.purchase!;

    return NextResponse.json({
      purchase: {
        id: purchase.id,
        packageName: purchase.package_name,
        creditsAmount: purchase.credits_amount,
        paymentStatus: purchase.payment_status,
        appliedAt: purchase.applied_at,
        createdAt: purchase.created_at,
      },
    });
  } catch (error) {
    logger.error("Error getting purchase status", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
