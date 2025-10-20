import { NextRequest, NextResponse } from "next/server";
import { CreditsService } from "@/lib/creditsService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    // Reembolsar créditos usando el servicio
    const result = await CreditsService.refundVideoCredits(videoId);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to refund credits" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Error in refund credits API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
