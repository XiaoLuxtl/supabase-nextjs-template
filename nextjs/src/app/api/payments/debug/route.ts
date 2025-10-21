// app/api/payments/debug/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const purchaseId = searchParams.get("purchase_id");

  if (!purchaseId) {
    return NextResponse.json(
      { error: "purchase_id required" },
      { status: 400 }
    );
  }

  const { data: purchase, error } = await supabase
    .from("credit_purchases")
    .select("*")
    .eq("id", purchaseId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Obtener balance del usuario
  const { data: user } = await supabase
    .from("user_profiles")
    .select("credits_balance")
    .eq("id", purchase.user_id)
    .single();

  return NextResponse.json({
    purchase: {
      id: purchase.id,
      user_id: purchase.user_id,
      payment_status: purchase.payment_status,
      payment_id: purchase.payment_id,
      applied_at: purchase.applied_at,
      credits_amount: purchase.credits_amount,
      created_at: purchase.created_at,
      updated_at: purchase.updated_at,
    },
    user: {
      credits_balance: user?.credits_balance,
    },
    status: purchase.applied_at ? "CREDITS_APPLIED" : "PENDING",
  });
}
