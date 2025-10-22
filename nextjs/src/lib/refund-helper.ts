// lib/refund-helper.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

/**
 * Función SEGURA para marcar video como fallido y reembolsar créditos
 * Usada por APIs del servidor (no por el cliente)
 */
export async function refundAndMarkFailed(
  videoId: string,
  userId?: string,
  errorMessage?: string,
  currentCredits?: number
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  console.log("🔄 Marking video as failed and refunding credit...");

  try {
    // Si no tenemos userId, obtenerlo del video
    let actualUserId = userId;
    if (!actualUserId) {
      const { data: video, error: videoError } = await supabase
        .from("video_generations")
        .select("user_id, credits_used")
        .eq("id", videoId)
        .single();

      if (videoError || !video) {
        console.error("❌ Cannot refund: video not found:", videoId);
        return {
          success: false,
          error: "Video not found",
          newBalance: currentCredits,
        };
      }
      actualUserId = video.user_id;
    }

    if (!actualUserId) {
      console.error("❌ Cannot refund: user_id not found for video:", videoId);
      // Marcar como failed sin refund
      await supabase
        .from("video_generations")
        .update({
          status: "failed",
          error_message: `${errorMessage} [Refund skipped: user not found]`,
        })
        .eq("id", videoId);
      return {
        success: false,
        error: "User not found",
        newBalance: currentCredits,
      };
    }

    // ✅ USAR LA FUNCIÓN SEGURA RPC
    const { data: refundResult, error: refundError } = await supabase.rpc(
      "refund_credits_for_video",
      { p_video_id: videoId }
    );

    if (refundError) {
      console.error("❌ RPC refund failed:", refundError);

      // ❌ NO FALLBACKS INSECUROS
      console.error("🔒 No insecure fallbacks allowed. Manual review needed.");

      // Pero aún así marcar como failed para evitar loops
      await supabase
        .from("video_generations")
        .update({
          status: "failed",
          error_message: `${errorMessage} [Refund failed: ${refundError.message}]`,
        })
        .eq("id", videoId);

      return {
        success: false,
        error: refundError.message,
        newBalance: currentCredits,
      };
    }

    console.log("✅ Refund successful, result:", refundResult);

    // ✅ Actualizar estado del video
    const { error: updateError } = await supabase
      .from("video_generations")
      .update({
        status: "failed",
        error_message: errorMessage,
        // credits_used ya fue actualizado a 0 por la RPC
      })
      .eq("id", videoId);

    if (updateError) {
      console.error("Error updating video status:", updateError);
    }

    // ✅ Devolver nuevos créditos
    if (refundResult?.success && refundResult.new_balance) {
      return {
        success: true,
        newBalance: refundResult.new_balance,
      };
    }

    // Fallback: asumir que se reembolsó 1 crédito
    return {
      success: true,
      newBalance: (currentCredits || 0) + 1,
    };
  } catch (error) {
    console.error("❌ Unexpected error in refundAndMarkFailed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      newBalance: currentCredits,
    };
  }
}
