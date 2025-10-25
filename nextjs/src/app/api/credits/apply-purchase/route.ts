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

// Define interfaces para el tipo de compra
interface Purchase {
  id: string;
  user_id: string;
  payment_status: string;
  applied_at: string | null;
  credits_amount?: number;
  package_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface ApplyPurchaseRequest {
  purchaseId: string;
}

interface ValidationResult {
  success: boolean;
  error?: string;
  purchase?: Purchase;
}

interface StatusValidationResult {
  success: boolean;
  error?: string;
}

interface RpcApplyResult {
  success: boolean;
  error?: string;
  error_code?: string;
  credits_added?: number;
  new_balance?: number;
  already_applied?: boolean;
  transaction_id?: string;
}

/**
 * Valida que la compra exista y pertenezca al usuario autenticado
 */
async function validatePurchaseOwnership(
  purchaseId: string,
  authenticatedUserId: string
): Promise<ValidationResult> {
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
function validatePurchaseStatus(purchase: Purchase): StatusValidationResult {
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

export async function POST(request: NextRequest): Promise<NextResponse> {
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
      const statusCode = ownershipValidation.error?.includes("not belong")
        ? 403
        : 404;
      return NextResponse.json(
        { error: ownershipValidation.error },
        { status: statusCode }
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

    // ✅ VALIDACIÓN MEJORADA DE LA RESPUESTA RPC
    if (!applyResult) {
      logger.error("No response from RPC call", {
        purchaseId,
        userId: authenticatedUserId,
      });
      return NextResponse.json(
        { error: "No response from credit application service" },
        { status: 500 }
      );
    }

    const rpcResult = applyResult as RpcApplyResult;

    if (!rpcResult.success) {
      // ✅ MANEJO MEJORADO DE ERRORES ESPECÍFICOS
      if (rpcResult.already_applied) {
        logger.info("Credits already applied, returning current balance", {
          purchaseId,
          userId: authenticatedUserId,
          newBalance: rpcResult.new_balance,
        });

        return NextResponse.json({
          success: true,
          credits_applied: false,
          already_applied: true,
          new_balance: rpcResult.new_balance,
          message: "Credits were already applied to this purchase",
        });
      }

      logger.error("Credit application failed via RPC", {
        purchaseId,
        userId: authenticatedUserId,
        error: rpcResult.error,
        errorCode: rpcResult.error_code,
      });

      const userMessage = rpcResult.error?.includes("not approved")
        ? "This purchase is not yet approved for credit application"
        : rpcResult.error || "Failed to apply credits";

      return NextResponse.json(
        {
          error: userMessage,
          error_code: rpcResult.error_code,
        },
        { status: 400 }
      );
    }

    // 7. ✅ ÉXITO - RESPUESTA COMPLETA
    logger.info("Purchase credits applied successfully via RPC", {
      purchaseId,
      userId: authenticatedUserId,
      creditsAdded: rpcResult.credits_added,
      newBalance: rpcResult.new_balance,
      transactionId: rpcResult.transaction_id,
    });

    return NextResponse.json({
      success: true,
      credits_applied: true,
      credits_added: rpcResult.credits_added,
      new_balance: rpcResult.new_balance,
      transaction_id: rpcResult.transaction_id,
      package_name: purchase.package_name,
      applied_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error("Unexpected error in apply-purchase API", {
      error: errorMessage,
      stack: errorStack,
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
export async function GET(request: NextRequest): Promise<NextResponse> {
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Error getting purchase status", {
      error: errorMessage,
    });

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
