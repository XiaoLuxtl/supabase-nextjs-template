// src/app/api/payments/check-pending/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Payment } from "mercadopago";
type PaymentSearchResult = {
  id?: string;
  status?: string;
  status_detail?: string;
};

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
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { error: "user_id es requerido" },
        { status: 400 }
      );
    }

    console.log("🔍 Checking pending payments for user:", user_id);

    // Buscar compras pendientes (últimas 10)
    const { data: pendingPurchases, error: purchaseError } = await supabase
      .from("credit_purchases")
      .select("*")
      .eq("user_id", user_id)
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    if (purchaseError) {
      console.error("❌ Error fetching pending purchases:", purchaseError);
      return NextResponse.json(
        { error: "Error al buscar compras pendientes" },
        { status: 500 }
      );
    }

    if (!pendingPurchases || pendingPurchases.length === 0) {
      console.log("ℹ️ No pending purchases found");
      return NextResponse.json({
        success: true,
        message: "No hay compras pendientes",
        processed: 0,
        checked: 0,
      });
    }

    console.log(`📋 Found ${pendingPurchases.length} pending purchases`);

    let processed = 0;
    let checked = 0;

    // Procesar cada compra pendiente
    for (const purchase of pendingPurchases) {
      checked++;

      try {
        console.log(
          `\n🔎 [${checked}/${pendingPurchases.length}] Processing purchase:`,
          {
            id: purchase.id,
            preference_id: purchase.preference_id,
            created_at: purchase.created_at,
          }
        );

        // Si no tiene preference_id, saltar
        if (!purchase.preference_id) {
          console.log("⚠️ No preference_id, skipping");
          continue;
        }

        // Buscar pagos asociados a esta preferencia
        let payments: PaymentSearchResult[] = [];

        try {
          const paymentsResponse = await paymentClient.search({
            options: {
              preference_id: purchase.preference_id,
            },
          });
          payments = paymentsResponse.results || [];
          console.log(`📥 Found ${payments.length} payments for preference`);
        } catch (searchError: unknown) {
          console.error(
            "⚠️ Error searching payments:",
            (searchError as Error)?.message || String(searchError)
          );

          // En desarrollo, si no encontramos pagos, continuar
          if (process.env.NODE_ENV === "development") {
            console.log("🧪 DEV mode: Continuing despite search error");
            continue;
          }
          throw searchError;
        }

        if (payments.length === 0) {
          console.log("ℹ️ No payments found for this preference");
          continue;
        }

        // Tomar el pago más reciente
        const payment = payments[0];
        console.log(`💳 Latest payment:`, {
          id: payment.id,
          status: payment.status,
          status_detail: payment.status_detail,
        });

        // Si el pago está aprobado y no se ha aplicado aún
        if (payment.status === "approved" && !purchase.applied_at) {
          console.log("✅ Payment approved! Applying credits...");

          // Actualizar estado del pago
          const { error: updateError } = await supabase
            .from("credit_purchases")
            .update({
              payment_id: payment.id?.toString(),
              payment_status: "approved",
            })
            .eq("id", purchase.id);

          if (updateError) {
            console.error("❌ Error updating purchase status:", updateError);
            continue;
          }

          // Aplicar créditos - VERSIÓN CORREGIDA
          const { data: applyResult, error: applyError } = await supabase.rpc(
            "apply_credit_purchase",
            {
              p_purchase_id: purchase.id,
            }
          );

          if (applyError) {
            console.error("❌ Error applying credits:", applyError);
          } else if (applyResult && !applyResult.success) {
            console.error("❌ Credit application failed:", applyResult.error);

            // Si ya estaba aplicado, contar como procesado
            if (applyResult.already_applied) {
              console.log("ℹ️ Credits were already applied");
              processed++;
            }
          } else {
            console.log("✅ Credits applied successfully!", {
              new_balance: applyResult?.new_balance,
              credits_added: applyResult?.credits_added,
            });
            processed++;
          }
        } else if (
          payment.status === "rejected" ||
          payment.status === "cancelled"
        ) {
          console.log(`❌ Payment ${payment.status}`);

          // Actualizar estado si fue rechazado
          await supabase
            .from("credit_purchases")
            .update({
              payment_id: payment.id?.toString(),
              payment_status: payment.status,
            })
            .eq("id", purchase.id);

          processed++; // Contar como procesado (aunque sea rechazado)
        } else if (payment.status === "pending") {
          console.log("⏳ Payment still pending");
        } else if (payment.status === "in_process") {
          console.log("🔄 Payment in process");
        } else {
          console.log("ℹ️ Payment status:", payment.status);
        }
      } catch (error) {
        console.error(`❌ Error processing purchase ${purchase.id}:`, error);
        // Continuar con la siguiente compra
      }
    }

    console.log(`\n✅ Finished checking. Processed: ${processed}/${checked}`);

    return NextResponse.json({
      success: true,
      message: `Se verificaron ${checked} compras, ${processed} fueron procesadas`,
      processed,
      checked,
      total_pending: pendingPurchases.length,
    });
  } catch (error) {
    console.error("❌ Error checking pending payments:", error);
    return NextResponse.json(
      {
        error: "Error interno del servidor",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
