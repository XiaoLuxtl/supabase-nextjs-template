import { NextRequest, NextResponse } from "next/server";
import { CreditsService } from "@/lib/creditsService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { purchaseId } = body;

    if (!purchaseId) {
      return NextResponse.json(
        { error: "purchaseId is required" },
        { status: 400 }
      );
    }

    // Aplicar compra usando el servicio
    const result = await CreditsService.applyPurchaseCredits(purchaseId);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to apply purchase" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Error in apply purchase API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
