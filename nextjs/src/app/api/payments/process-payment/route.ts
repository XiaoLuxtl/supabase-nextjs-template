// src/app/api/payments/process-payment/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { createClient } from "@supabase/supabase-js";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const paymentClient = new Payment(client);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payment_id, external_reference } = body;

    console.log("🔍 Processing payment:", { payment_id, external_reference });

    if (!payment_id || !external_reference) {
      return NextResponse.json(
        { error: "payment_id and external_reference required" },
        { status: 400 }
      );
    }

    // 1️⃣ Verificar que la compra existe
    const { data: purchase, error: purchaseError } = await supabase
      .from("credit_purchases")
      .select("*")
      .eq("id", external_reference)
      .single();

    if (purchaseError || !purchase) {
      console.error("❌ Purchase not found:", external_reference);
      return NextResponse.json(
        { error: "Purchase not found" },
        { status: 404 }
      );
    }

    console.log("✅ Purchase found:", {
      id: purchase.id,
      status: purchase.payment_status,
      applied: !!purchase.applied_at,
    });

    // 2️⃣ Si ya se aplicó, retornar éxito inmediatamente
    if (purchase.applied_at) {
      console.log("ℹ️ Credits already applied");

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
    let payment;
    let usedFallback = false;

    try {
      console.log("📞 Fetching payment from Mercado Pago...");
      payment = await paymentClient.get({ id: payment_id });
      console.log("✅ Payment fetched:", {
        id: payment.id,
        status: payment.status,
        external_reference: payment.external_reference,
      });
    } catch (error: any) {
      console.error("❌ Failed to get payment from MP:", error.message);

      // 🧪 FALLBACK PARA DESARROLLO
      const isDevelopment = process.env.NODE_ENV === "development";
      const isTestCredentials =
        process.env.MERCADOPAGO_ACCESS_TOKEN?.includes("APP_USR");

      if (isDevelopment || isTestCredentials) {
        console.log("🧪 DEV/TEST mode: Using fallback (treating as approved)");
        usedFallback = true;
        payment = {
          id: payment_id,
          status: "approved",
          external_reference: external_reference,
        };
      } else {
        // En producción, si el pago no existe, es retryable
        return NextResponse.json(
          {
            error: "Payment not found in Mercado Pago",
            retryable: true,
            details: "El pago está siendo procesado. Intenta en unos segundos.",
          },
          { status: 404 }
        );
      }
    }

    // 4️⃣ Verificar que el external_reference coincide
    if (!usedFallback && payment.external_reference !== external_reference) {
      console.error("❌ External reference mismatch:", {
        expected: external_reference,
        received: payment.external_reference,
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

    console.log("📊 Payment status:", newStatus);

    // 6️⃣ Actualizar estado en la base de datos
    const { error: updateError } = await supabase
      .from("credit_purchases")
      .update({
        payment_id: payment.id?.toString(),
        payment_status: newStatus,
      })
      .eq("id", external_reference);

    if (updateError) {
      console.error("❌ Error updating purchase:", updateError);
      return NextResponse.json(
        { error: "Failed to update purchase" },
        { status: 500 }
      );
    }

    // 7️⃣ Si fue aprobado, aplicar créditos
    if (newStatus === "approved") {
      console.log("💰 Applying credits...");

      const { error: applyError } = await supabase.rpc(
        "apply_credit_purchase",
        { p_purchase_id: external_reference }
      );

      if (applyError) {
        console.error("❌ Error applying credits:", applyError);
        return NextResponse.json(
          {
            error: "Failed to apply credits",
            details: applyError.message,
          },
          { status: 500 }
        );
      }

      console.log("✅ Credits applied successfully");

      // Obtener balance actualizado
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("credits_balance")
        .eq("id", purchase.user_id)
        .single();

      return NextResponse.json({
        success: true,
        status: newStatus,
        credits_applied: true,
        new_balance: profile?.credits_balance || 0,
        used_fallback: usedFallback,
      });
    }

    // 8️⃣ Si no fue aprobado, retornar el estado
    return NextResponse.json({
      success: true,
      status: newStatus,
      credits_applied: false,
      message:
        newStatus === "pending"
          ? "El pago está pendiente"
          : "El pago no fue aprobado",
    });
  } catch (error) {
    console.error("❌ Process payment error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
