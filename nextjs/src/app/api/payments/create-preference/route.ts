// src/app/api/payments/create-preference/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { package_id, credits_amount, user_id } = body;

    // Validar datos
    if (!package_id || !user_id) {
      return NextResponse.json(
        { error: "package_id y user_id son requeridos" },
        { status: 400 }
      );
    }

    // Obtener paquete de la DB
    const { data: pkg, error: pkgError } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("id", package_id)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    // Calcular precio y créditos
    let finalPrice: number;
    let finalCredits: number;

    if (pkg.package_type === "fixed") {
      finalPrice = pkg.price_mxn!;
      finalCredits = pkg.credits_amount!;
    } else {
      // Custom package
      if (!credits_amount || credits_amount < (pkg.min_credits || 0)) {
        return NextResponse.json(
          { error: `Mínimo ${pkg.min_credits} créditos requeridos` },
          { status: 400 }
        );
      }
      finalPrice = credits_amount * (pkg.price_per_credit || 0);
      finalCredits = credits_amount;
    }

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
      console.error("Error creating purchase:", purchaseError);
      return NextResponse.json(
        { error: "Error al crear orden" },
        { status: 500 }
      );
    }

    // Crear preferencia en Mercado Pago
    let appUrl = process.env.NEXT_PUBLIC_APP_URL;

    // En desarrollo, usar HTTP localhost si no hay URL configurada
    if (!appUrl) {
      appUrl = "http://localhost:3000";
    }

    // En producción, asegurar HTTPS
    if (
      process.env.NODE_ENV === "production" &&
      !appUrl.startsWith("https://")
    ) {
      console.warn("⚠️ NEXT_PUBLIC_APP_URL should use HTTPS in production");
    }

    // Ensure URL doesn't end with a slash
    appUrl = appUrl.replace(/\/$/, "");

    const preferenceData = {
      items: [
        {
          id: package_id,
          title: `${pkg.name} - ${finalCredits} créditos`,
          description: pkg.description || "",
          quantity: 1,
          unit_price: finalPrice,
          currency_id: "MXN",
        },
      ],
      // Enviar back_urls siempre (funcionan en sandbox también)
      back_urls: {
        success: `${appUrl}/paquetes/success`,
        failure: `${appUrl}/paquetes/failure`,
        pending: `${appUrl}/paquetes/success`,
      },
      // Solo enviar notification_url en producción (en desarrollo localhost no es accesible)
      ...(process.env.NODE_ENV === "production"
        ? {
            notification_url: `${appUrl}/api/payments/webhook`,
          }
        : {}),
      external_reference: purchase.id, // ID de nuestra compra
      metadata: {
        purchase_id: purchase.id,
        user_id: user_id,
        credits_amount: finalCredits,
      },
    };

    console.log("Success URL:", preferenceData.back_urls.success);
    console.log(
      "Notification URL:",
      preferenceData.notification_url || "Not set (development mode)"
    );
    console.log(
      "Full preference data:",
      JSON.stringify(preferenceData, null, 2)
    );

    const mpPreference = await preference.create({ body: preferenceData });

    // Actualizar purchase con preference_id
    await supabase
      .from("credit_purchases")
      .update({ preference_id: mpPreference.id })
      .eq("id", purchase.id);

    // Determinar qué URL usar basado en el entorno del servidor
    const isProduction = process.env.NODE_ENV === "production";
    const checkoutUrl = isProduction
      ? mpPreference.init_point
      : mpPreference.sandbox_init_point;

    console.log("🌍 Environment:", process.env.NODE_ENV);
    console.log("🔗 Using checkout URL:", checkoutUrl);

    return NextResponse.json({
      success: true,
      preference_id: mpPreference.id,
      checkout_url: checkoutUrl, // URL correcta basada en el entorno
      init_point: mpPreference.init_point,
      sandbox_init_point: mpPreference.sandbox_init_point,
    });
  } catch (error) {
    console.error("Error creating preference:", error);
    return NextResponse.json(
      { error: "Error al crear preferencia de pago" },
      { status: 500 }
    );
  }
}
