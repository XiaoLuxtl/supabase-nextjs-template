import { NextRequest, NextResponse } from "next/server";
import { CreditsService } from "@/lib/creditsService";
import {
  authenticateUser,
  validateResourceOwnership,
  VALIDATION_LIMITS,
} from "@/lib/auth";
import { logger } from "@/lib/utils/logger";
import { createSSRClient } from "@/lib/supabase/server";

/**
 * Valida los parámetros de entrada del request
 */
function validateInputParams(
  userId: unknown,
  videoId: unknown,
  authenticatedUserId: string
): NextResponse | null {
  if (!userId || typeof userId !== "string") {
    logger.warn("Invalid userId provided", {
      authenticatedUserId,
      userId: userId ? typeof userId : "undefined",
    });
    return NextResponse.json(
      { error: "Valid userId is required" },
      { status: 400 }
    );
  }

  if (!videoId || typeof videoId !== "string") {
    logger.warn("Invalid videoId provided", {
      authenticatedUserId,
      videoId: videoId ? typeof videoId : "undefined",
    });
    return NextResponse.json(
      { error: "Valid videoId is required" },
      { status: 400 }
    );
  }

  // Validar formato UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    logger.warn("Invalid UUID format for userId", {
      authenticatedUserId,
      userId,
    });
    return NextResponse.json(
      { error: "Invalid userId format" },
      { status: 400 }
    );
  }

  if (!uuidRegex.test(videoId)) {
    logger.warn("Invalid UUID format for videoId", {
      authenticatedUserId,
      videoId,
    });
    return NextResponse.json(
      { error: "Invalid videoId format" },
      { status: 400 }
    );
  }

  return null; // No validation errors
}

/**
 * Valida la propiedad del recurso y el estado del video
 */
async function validateVideoOwnershipAndState(
  authenticatedUserId: string,
  userId: string,
  videoId: string
): Promise<{
  response: NextResponse | null;
  video: {
    id: string;
    user_id: string;
    status: string | null; // 👈 Permitir null
    credits_used: number | null; // 👈 Permitir null
  } | null;
}> {
  // Verificar que el usuario solo pueda consumir sus propios créditos
  if (!validateResourceOwnership(authenticatedUserId, userId)) {
    logger.warn("User attempted to consume credits for another user", {
      authenticatedUserId,
      targetUserId: userId,
    });
    return {
      response: NextResponse.json({ error: "Access denied" }, { status: 403 }),
      video: null,
    };
  }

  // Verificar que el video existe y pertenece al usuario
  const supabase = await createSSRClient();
  const { data: video, error: videoError } = await supabase
    .from("video_generations")
    .select("id, user_id, status, credits_used")
    .eq("id", videoId)
    .single();

  if (videoError && videoError.code !== "PGRST116") {
    // PGRST116 = not found
    logger.error("Error checking video ownership", {
      authenticatedUserId,
      videoId,
      error: videoError,
    });
    return {
      response: NextResponse.json(
        { error: "Error validating video" },
        { status: 500 }
      ),
      video: null,
    };
  }

  // Si el video existe, verificar que pertenece al usuario
  if (video && !validateResourceOwnership(authenticatedUserId, video.user_id)) {
    logger.warn("User attempted to consume credits for video they don't own", {
      authenticatedUserId,
      videoId,
      videoOwnerId: video.user_id,
    });
    return {
      response: NextResponse.json({ error: "Access denied" }, { status: 403 }),
      video: null,
    };
  }

  // Si el video ya tiene créditos usados, no permitir consumir más
  if (video?.credits_used && video.credits_used > 0) {
    logger.warn(
      "Attempted to consume credits for video that already used credits",
      {
        authenticatedUserId,
        videoId,
        creditsUsed: video.credits_used,
      }
    );
    return {
      response: NextResponse.json(
        { error: "Credits already consumed for this video" },
        { status: 400 }
      ),
      video: null,
    };
  }

  return { response: null, video };
}

export async function POST(request: NextRequest) {
  try {
    // Autenticar usuario
    const authResult = await authenticateUser(request);
    if (!authResult.success || !authResult.user) {
      logger.warn("Unauthorized attempt to consume credits", {
        error: authResult.error,
        ip:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip"),
      });
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const authenticatedUserId = authResult.user.id;

    const body = await request.json();
    const { userId, videoId } = body;

    // Validar parámetros de entrada
    const validationError = validateInputParams(
      userId,
      videoId,
      authenticatedUserId
    );
    if (validationError) {
      return validationError;
    }

    // Validar propiedad del video y estado
    const { response: ownershipError } = await validateVideoOwnershipAndState(
      authenticatedUserId,
      userId,
      videoId
    );
    if (ownershipError) {
      return ownershipError;
    }

    // Verificar balance actual antes de consumir
    const currentBalance = await CreditsService.getBalance(userId);
    if (currentBalance < VALIDATION_LIMITS.MIN_CREDITS_PER_VIDEO) {
      logger.warn("Insufficient credits for video generation", {
        authenticatedUserId,
        videoId,
        currentBalance,
        required: VALIDATION_LIMITS.MIN_CREDITS_PER_VIDEO,
      });
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 400 }
      );
    }

    // Consumir créditos usando el servicio
    const result = await CreditsService.consumeCreditsForVideo(userId, videoId);

    if (!result.success) {
      logger.error("Failed to consume credits for video", {
        authenticatedUserId,
        videoId,
        currentBalance,
      });
      return NextResponse.json(
        { error: "Failed to consume credits" },
        { status: 500 }
      );
    }

    logger.info("Credits consumed successfully for video", {
      authenticatedUserId,
      videoId,
      previousBalance: currentBalance,
      newBalance: result.newBalance,
    });

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
    });
  } catch (error) {
    logger.error("Unexpected error in consume credits API", {
      error,
      ip:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip"),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
