import { NextRequest, NextResponse } from "next/server";
import { CreditsService } from "@/lib/creditsService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, videoId } = body;

    if (!userId || !videoId) {
      return NextResponse.json(
        { error: "userId and videoId are required" },
        { status: 400 }
      );
    }

    // Consumir créditos usando el servicio
    const result = await CreditsService.consumeCreditsForVideo(userId, videoId);

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to consume credits" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Error in consume credits API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
