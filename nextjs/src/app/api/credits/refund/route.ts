import { NextRequest, NextResponse } from "next/server";
import { CreditsService } from "@/lib/creditsService";

interface RefundRequestBody {
  videoId: string;
}

interface RefundResponse {
  success: boolean;
  newBalance?: number;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: RefundRequestBody = await request.json();
    const { videoId } = body;

    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    console.log("🔄 [Refund API] Processing refund for video:", videoId);

    // ✅ USAR NUEVO MÉTODO: refundForViduFailure
    const result = await CreditsService.refundForViduFailure(videoId);

    if (!result.success) {
      console.error("❌ [Refund API] Refund failed:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to refund credits" },
        { status: 500 }
      );
    }

    const response: RefundResponse = {
      success: true,
      newBalance: result.newBalance,
    };

    console.log("✅ [Refund API] Refund completed:", {
      videoId,
      newBalance: result.newBalance,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("💥 [Refund API] Unexpected error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
