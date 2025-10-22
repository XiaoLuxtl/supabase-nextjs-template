// src/app/api/payments/create-preference/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateUser,
  validateResourceOwnership,
  VALIDATION_LIMITS,
} from "@/lib/auth";
import { logger } from "@/lib/utils/logger";

// Type definitions
interface PaymentRequestBody {
  package_id: string;
  credits_amount?: number;
  user_id: string;
}

interface CreditPackage {
  id: string;
  name: string;
  description?: string;
  package_type: "fixed" | "custom";
  price_mxn?: number;
  credits_amount?: number;
  min_credits?: number;
  price_per_credit?: number;
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
  preference_id?: string;
}

// Inicializar Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  options: { timeout: 5000 },
});

const preference = new Preference(client);

// Supabase server client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

// Helper functions to reduce cognitive complexity
type ValidationResult =
  | {
      success: true;
      package_id: string;
      credits_amount?: number;
      user_id: string;
    }
  | { success: false; error: string; status: number };

async function validateInput(
  body: PaymentRequestBody,
  authenticatedUserId: string
): Promise<ValidationResult> {
  const { package_id, credits_amount, user_id } = body;

  // 🔒 VALIDACIÓN DE PROPIEDAD: El user_id debe coincidir con el usuario autenticado
  if (!validateResourceOwnership(authenticatedUserId, user_id)) {
    logger.warn("User attempted to create payment for different user", {
      authenticatedUserId,
      requestedUserId: user_id,
      ip: "unknown", // Will be set by caller
    });
    return {
      success: false,
      error: "Forbidden: Cannot create payments for other users",
      status: 403,
    };
  }

  // ✅ VALIDACIÓN DE ENTRADA
  if (!package_id) {
    logger.warn("Missing package_id in payment creation", {
      userId: authenticatedUserId,
    });
    return { success: false, error: "package_id es requerido", status: 400 };
  }

  return { success: true, package_id, credits_amount, user_id };
}

type LimitCheckResult =
  | { success: true }
  | { success: false; error: string; status: number };

async function checkPendingPurchasesLimit(
  authenticatedUserId: string
): Promise<LimitCheckResult> {
  // 🛡️ RATE LIMITING: Verificar compras pendientes del usuario
  const { data: pendingPurchases, error: pendingError } = await supabase
    .from("credit_purchases")
    .select("id")
    .eq("user_id", authenticatedUserId)
    .eq("payment_status", "pending");

  if (pendingError) {
    logger.error("Error checking pending purchases", pendingError);
    return { success: false, error: "Error interno del servidor", status: 500 };
  }

  if (
    pendingPurchases &&
    pendingPurchases.length >= VALIDATION_LIMITS.MAX_PENDING_PURCHASES
  ) {
    logger.warn("User has too many pending purchases", {
      userId: authenticatedUserId,
      pendingCount: pendingPurchases.length,
      limit: VALIDATION_LIMITS.MAX_PENDING_PURCHASES,
    });
    return {
      success: false,
      error: `Demasiadas compras pendientes. Máximo ${VALIDATION_LIMITS.MAX_PENDING_PURCHASES} compras pendientes permitidas.`,
      status: 429,
    };
  }

  return { success: true };
}

type PriceCalculationResult =
  | { success: true; finalPrice: number; finalCredits: number }
  | { success: false; error: string; status: number };

function calculatePriceAndCredits(
  pkg: CreditPackage,
  credits_amount?: number
): PriceCalculationResult {
  let finalPrice: number;
  let finalCredits: number;

  if (pkg.package_type === "fixed") {
    finalPrice = pkg.price_mxn!;
    finalCredits = pkg.credits_amount!;
  } else {
    // Custom package
    if (!credits_amount || credits_amount < (pkg.min_credits || 0)) {
      return {
        success: false,
        error: `Mínimo ${pkg.min_credits} créditos requeridos`,
        status: 400,
      };
    }
    finalPrice = credits_amount * (pkg.price_per_credit || 0);
    finalCredits = credits_amount;
  }

  return { success: true, finalPrice, finalCredits };
}

async function createMercadoPagoPreference(
  purchase: CreditPurchase,
  pkg: CreditPackage,
  finalPrice: number,
  finalCredits: number,
  user_id: string
) {
  let appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // En desarrollo, usar HTTP localhost si no hay URL configurada
  if (!appUrl) {
    appUrl = "http://localhost:3000";
  }

  // En producción, asegurar HTTPS
  if (process.env.NODE_ENV === "production" && !appUrl.startsWith("https://")) {
    logger.warn("⚠️ NEXT_PUBLIC_APP_URL should use HTTPS in production");
  }

  // Ensure URL doesn't end with a slash
  appUrl = appUrl.replace(/\/$/, "");

  const preferenceData = {
    items: [
      {
        id: purchase.package_id,
        title: `${pkg.name} - ${finalCredits} créditos`,
        description: pkg.description || "",
        quantity: 1,
        unit_price: finalPrice,
        currency_id: "MXN",
      },
    ],
    back_urls: {
      success: `${appUrl}/paquetes/success`,
      failure: `${appUrl}/paquetes/failure`,
      pending: `${appUrl}/paquetes/pending`,
    },
    // auto_return: "approved",
    notification_url: `${appUrl}/api/payments/webhook`,
    external_reference: purchase.id, // ID de nuestra compra
    metadata: {
      purchase_id: purchase.id,
      user_id: user_id,
      credits_amount: finalCredits,
    },
  };

  logger.info("Creating MercadoPago preference", {
    purchaseId: purchase.id,
    userId: user_id,
    packageName: pkg.name,
    credits: finalCredits,
    price: finalPrice,
  });

  const mpPreference = await preference.create({ body: preferenceData });

  // Actualizar purchase con preference_id
  await supabase
    .from("credit_purchases")
    .update({ preference_id: mpPreference.id })
    .eq("id", purchase.id);

  return mpPreference;
}

export async function POST(request: NextRequest) {
  try {
    // 🔐 AUTENTICACIÓN: Verificar usuario autenticado
    const authResult = await authenticateUser(request);
    if (!authResult.success || !authResult.user) {
      logger.warn("Unauthorized payment preference creation attempt", {
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

    // Validar entrada y propiedad del recurso
    const validationResult = await validateInput(body, authenticatedUserId);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: validationResult.status }
      );
    }

    const { package_id, credits_amount, user_id } = validationResult;

    // Obtener paquete de la DB
    const { data: pkg, error: pkgError } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("id", package_id)
      .single();

    if (pkgError || !pkg) {
      logger.warn("Package not found", {
        packageId: package_id,
        userId: authenticatedUserId,
      });
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    // Verificar límites de compras pendientes
    const limitCheck = await checkPendingPurchasesLimit(authenticatedUserId);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: limitCheck.error },
        { status: limitCheck.status }
      );
    }

    // Calcular precio y créditos
    const priceCalculation = calculatePriceAndCredits(pkg, credits_amount);
    if (!priceCalculation.success) {
      return NextResponse.json(
        { error: priceCalculation.error },
        { status: priceCalculation.status }
      );
    }

    const { finalPrice, finalCredits } = priceCalculation;

    // Crear registro de compra pendiente
    const { data: purchase, error: purchaseError } = await supabase
      .from("credit_purchases")
      .insert({
        user_id,
        package_id,
        package_name: pkg.name,
        credits_amount: finalCredits,
        price_paid_mxn: finalPrice,
        payment_method: "mercadopago",
        payment_status: "pending",
      })
      .select()
      .single();

    if (purchaseError) {
      logger.error("Error creating purchase record", purchaseError);
      return NextResponse.json(
        { error: "Error al crear orden" },
        { status: 500 }
      );
    }

    // Crear preferencia en Mercado Pago
    const mpPreference = await createMercadoPagoPreference(
      purchase,
      pkg,
      finalPrice,
      finalCredits,
      user_id
    );

    return NextResponse.json({
      success: true,
      preference_id: mpPreference.id,
      init_point: mpPreference.init_point, // URL para redirigir
      sandbox_init_point: mpPreference.sandbox_init_point, // URL de sandbox (TEST)
    });
  } catch (error) {
    logger.error("Error creating payment preference", error);
    return NextResponse.json(
      { error: "Error al crear preferencia de pago" },
      { status: 500 }
    );
  }
}
