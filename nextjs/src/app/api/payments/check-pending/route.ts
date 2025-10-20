import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MercadoPagoConfig, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

const paymentClient = new Payment(client);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

/**
 * Endpoint para verificar pagos pendientes en desarrollo
 * Busca pagos con estado 'pending' para el usuario y los procesa
 */
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

    console.log("Checking pending payments for user:", user_id);

    // Buscar compras pendientes para este usuario
    const { data: pendingPurchases, error: purchaseError } = await supabase
      .from("credit_purchases")
      .select("*")
      .eq("user_id", user_id)
      .eq("payment_status", "pending")
      .order("created_at", { ascending: false })
      .limit(5); // Últimas 5 compras pendientes

    if (purchaseError) {
      console.error("Error fetching pending purchases:", purchaseError);
      return NextResponse.json(
        { error: "Error al buscar compras pendientes" },
        { status: 500 }
      );
    }

    if (!pendingPurchases || pendingPurchases.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay compras pendientes",
        processed: 0,
      });
    }

    console.log(`Found ${pendingPurchases.length} pending purchases`);

    let processed = 0;

    // Procesar cada compra pendiente
    for (const purchase of pendingPurchases) {
      try {
        console.log(
          `Processing purchase ${purchase.id} with preference ${purchase.preference_id}`
        );

        // Si no tiene preference_id, saltar
        if (!purchase.preference_id) {
          console.log(`Purchase ${purchase.id} has no preference_id, skipping`);
          continue;
        }

        // Buscar pagos asociados a esta preferencia
        const paymentsResponse = await paymentClient.search({
          options: {
            preference_id: purchase.preference_id,
          },
        });

        const payments = paymentsResponse.results || [];

        if (payments.length === 0) {
          console.log(
            `No payments found for preference ${purchase.preference_id}`
          );
          continue;
        }

        // Tomar el pago más reciente
        const payment = payments[0];
        console.log(
          `Found payment ${payment.id} with status ${payment.status}`
        );

        // Si el pago está aprobado y no se ha aplicado aún
        if (payment.status === "approved" && !purchase.applied_at) {
          console.log(`Applying credits for purchase ${purchase.id}`);

          // Actualizar estado del pago
          await supabase
            .from("credit_purchases")
            .update({
              payment_id: payment.id?.toString(),
              payment_status: "approved",
            })
            .eq("id", purchase.id);

          // Aplicar créditos
          const { error: applyError } = await supabase.rpc(
            "apply_credit_purchase",
            { p_purchase_id: purchase.id }
          );

          if (applyError) {
            console.error(
              `Error applying credits for purchase ${purchase.id}:`,
              applyError
            );
          } else {
            console.log(
              `Credits applied successfully for purchase ${purchase.id}`
            );
            processed++;
          }
        } else if (
          payment.status === "rejected" ||
          payment.status === "cancelled"
        ) {
          // Actualizar estado si fue rechazado
          await supabase
            .from("credit_purchases")
            .update({
              payment_id: payment.id?.toString(),
              payment_status: payment.status,
            })
            .eq("id", purchase.id);

          console.log(
            `Updated purchase ${purchase.id} status to ${payment.status}`
          );
        }
      } catch (error) {
        console.error(`Error processing purchase ${purchase.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Procesadas ${processed} compras pendientes`,
      processed,
      total_pending: pendingPurchases.length,
    });
  } catch (error) {
    console.error("Error checking pending payments:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
