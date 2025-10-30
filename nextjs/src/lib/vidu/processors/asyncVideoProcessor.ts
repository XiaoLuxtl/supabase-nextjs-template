// src/lib/vidu/processors/asyncVideoProcessor.ts

import { createClient } from "@supabase/supabase-js";
import { ViduClient } from "../clients/viduClient";
import { CreditsService } from "@/lib/creditsService";
import { ImageProcessor } from "./imageProcessor";
import { Database, Json } from "@/types/database.types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

interface AsyncProcessingResult {
  success: boolean;
  error?: string;
  videoId: string;
  status: string | null;
}

export class AsyncVideoProcessor {
  /**
   * 🎯 PROCESAMIENTO ASÍNCRONO PRINCIPAL
   * Maneja toda la generación de video después de la transacción atómica
   */
  static async processVideoGeneration(
    videoId: string,
    prompt: string,
    imageBase64?: string
  ): Promise<AsyncProcessingResult> {
    try {
      console.log("🔄 [AsyncProcessor] Starting async video processing:", {
        videoId,
        promptLength: prompt.length,
        hasImage: !!imageBase64,
      });

      // 1. Verificar que el video existe y está en estado pending
      const video = await this.getVideoRecord(videoId);
      if (!video) {
        return {
          success: false,
          error: "Video record not found",
          videoId,
          status: "failed",
        };
      }

      if (video.status !== "pending") {
        console.warn(
          "⚠️ [AsyncProcessor] Video already processed:",
          video.status
        );
        return {
          success: true,
          videoId,
          status: video.status,
        };
      }

      // 2. Procesar imagen y refinar prompt si es necesario
      console.log(
        "🎨 [AsyncProcessor] Processing image and refining prompt..."
      );
      const { refinedPrompt } = await this.processImageAndPrompt(
        prompt,
        imageBase64
      );

      // 3. Llamar a Vidu API
      console.log("🚀 [AsyncProcessor] Calling Vidu API...");
      const viduResult = await ViduClient.generateVideoAsync(
        refinedPrompt,
        imageBase64
      );

      if (!viduResult.success || !viduResult.taskId) {
        console.error("❌ [AsyncProcessor] Vidu API failed:", viduResult.error);

        // ✅ REEMBOLSO AUTOMÁTICO
        await this.handleViduFailure(
          videoId,
          viduResult.error || "Unknown Vidu error"
        );

        return {
          success: false,
          error: `Vidu API failed: ${viduResult.error}`,
          videoId,
          status: "failed",
        };
      }

      // 4. ✅ ÉXITO - Actualizar con datos de Vidu
      console.log("✅ [AsyncProcessor] Vidu API success, updating record...");
      await this.updateWithViduSuccess(
        videoId,
        viduResult.taskId,
        viduResult.data,
        refinedPrompt
      );

      console.log(
        "🎉 [AsyncProcessor] Async video processing completed:",
        videoId
      );

      return {
        success: true,
        videoId,
        status: "processing",
      };
    } catch (error) {
      console.error("❌ [AsyncProcessor] Unexpected error:", error);

      // 🔄 REEMBOLSO POR ERROR INESPERADO
      await this.handleUnexpectedError(videoId, error);

      // Si es un error NSFW, devolver el mensaje específico
      const isNSFWError =
        error instanceof Error &&
        error.message.includes("NSFW content detected");

      return {
        success: false,
        error: isNSFWError ? error.message : "Unexpected processing error",
        videoId,
        status: "failed",
      };
    }
  }

  /**
   * 🎨 PROCESAR IMAGEN Y REFINAR PROMPT
   */
  private static async processImageAndPrompt(
    prompt: string,
    imageBase64?: string
  ): Promise<{ refinedPrompt: string; imageDescription: string }> {
    let imageDescription = "ninguna imagen proporcionada";
    let refinedPrompt = prompt;

    try {
      if (imageBase64) {
        console.log("🖼️ [AsyncProcessor] Processing image...");

        const imageResult = await ImageProcessor.processImage(imageBase64);

        // ⚠️ DEFENSA EN PROFUNDIDAD: Si por alguna razón llega NSFW aquí,
        // significa que la validación del endpoint falló (bug crítico)
        if (imageResult.nsfwCheck?.isNSFW) {
          console.error(
            "🚨 [AsyncProcessor] CRÍTICO: NSFW detectado en procesamiento asíncrono!"
          );
          console.error(
            "🚨 [AsyncProcessor] Esto significa que la validación del endpoint falló"
          );
          throw new Error(
            `CRITICAL: NSFW content detected in async processing: ${imageResult.nsfwCheck.reason}`
          );
        }

        imageDescription =
          imageResult.imageDescription || "imagen proporcionada";

        // Refinar prompt con descripción de imagen
        refinedPrompt = await ImageProcessor.refinePrompt(
          prompt,
          imageDescription
        );

        console.log("✅ [AsyncProcessor] Image processing completed");
      } else {
        console.log(
          "ℹ️ [AsyncProcessor] No image provided, using original prompt"
        );
        refinedPrompt = await ImageProcessor.refinePrompt(
          prompt,
          imageDescription
        );
      }

      return { refinedPrompt, imageDescription };
    } catch (error) {
      console.error("❌ [AsyncProcessor] Image processing failed:", error);

      // Si es error NSFW, propagarlo específicamente
      if (
        error instanceof Error &&
        error.message.includes("NSFW content detected")
      ) {
        throw error; // Propagar el error NSFW
      }

      // Para otros errores de procesamiento de imagen, continuar con el prompt original
      return {
        refinedPrompt: prompt,
        imageDescription: "error processing image",
      };
    }
  }

  /**
   * ❌ MANEJAR FALLA DE VIDU
   */
  private static async handleViduFailure(
    videoId: string,
    error: string
  ): Promise<void> {
    try {
      console.log(
        "🔄 [AsyncProcessor] Handling Vidu failure with auto-refund..."
      );

      // 1. Reembolso automático
      const refundResult = await CreditsService.refundForViduFailure(videoId);

      // 2. Actualizar estado de error
      await this.markAsViduFailed(videoId, error, refundResult.success);

      if (refundResult.success) {
        console.log("✅ [AsyncProcessor] Auto-refund completed successfully");
      } else {
        console.error(
          "❌ [AsyncProcessor] Auto-refund failed:",
          refundResult.error
        );
      }
    } catch (refundError) {
      console.error(
        "❌ [AsyncProcessor] Error in Vidu failure handler:",
        refundError
      );
      // Aún así marcar como fallido
      await this.markAsViduFailed(videoId, error, false);
    }
  }

  /**
   * 🚨 MANEJAR ERROR INESPERADO
   */
  private static async handleUnexpectedError(
    videoId: string,
    error: unknown
  ): Promise<void> {
    try {
      console.error("🚨 [AsyncProcessor] Handling unexpected error:", error);

      // Intentar reembolso
      const refundResult = await CreditsService.refundForViduFailure(videoId);

      await this.markAsViduFailed(
        videoId,
        `Unexpected processing error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        refundResult.success
      );
    } catch (handlerError) {
      console.error(
        "💥 [AsyncProcessor] Critical error in error handler:",
        handlerError
      );
      // Último intento de marcar como fallido
      await this.safeMarkAsFailed(videoId, "Critical processing error");
    }
  }

  /**
   * 📝 MARCAR COMO FALLIDO POR VIDU
   */
  private static async markAsViduFailed(
    videoId: string,
    error: string,
    refundSuccess: boolean
  ): Promise<void> {
    try {
      const errorMessage = refundSuccess
        ? `Vidu processing failed: ${error} [Credits refunded]`
        : `Vidu processing failed: ${error} [Refund failed]`;

      await supabase
        .from("video_generations")
        .update({
          status: "failed",
          error_message: errorMessage,
          error_code: "VIDU_API_ERROR",
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId);

      console.log("📝 [AsyncProcessor] Video marked as failed:", errorMessage);
    } catch (updateError) {
      console.error(
        "❌ [AsyncProcessor] Failed to mark video as failed:",
        updateError
      );
    }
  }

  /**
   * 🔒 MARCAR COMO FALLIDO (método seguro)
   */
  private static async safeMarkAsFailed(
    videoId: string,
    error: string
  ): Promise<void> {
    try {
      await supabase
        .from("video_generations")
        .update({
          status: "failed",
          error_message: error,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId);
    } catch (error) {
      console.error(
        "💥 [AsyncProcessor] Critical: Cannot update video status:",
        error
      );
    }
  }

  /**
   * ✅ ACTUALIZAR CON ÉXITO DE VIDU
   */
  private static async updateWithViduSuccess(
    videoId: string,
    taskId: string,
    viduData: unknown,
    refinedPrompt: string
  ): Promise<void> {
    try {
      const updateData: Partial<
        Database["public"]["Tables"]["video_generations"]["Update"]
      > = {
        status: "processing",
        vidu_task_id: taskId,
        translated_prompt_en: refinedPrompt,
        vidu_full_response: JSON.parse(JSON.stringify(viduData)) as Json,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("video_generations")
        .update(updateData)
        .eq("id", videoId);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      console.log(
        "📝 [AsyncProcessor] Video updated with Vidu data successfully"
      );
    } catch (error) {
      console.error(
        "❌ [AsyncProcessor] Failed to update video with Vidu data:",
        error
      );
      // Si no podemos actualizar, considerar como falla
      await this.handleViduFailure(videoId, "Failed to update video record");
      throw error;
    }
  }

  /**
   * 📋 OBTENER REGISTRO DE VIDEO
   */
  private static async getVideoRecord(
    videoId: string
  ): Promise<Database["public"]["Tables"]["video_generations"]["Row"] | null> {
    try {
      const { data, error } = await supabase
        .from("video_generations")
        .select("*")
        .eq("id", videoId)
        .single();

      if (error) {
        console.error("❌ [AsyncProcessor] Error fetching video:", error);
        return null;
      }

      return data;
    } catch (error) {
      console.error(
        "❌ [AsyncProcessor] Unexpected error fetching video:",
        error
      );
      return null;
    }
  }

  /**
   * 🔄 REINTENTAR PROCESAMIENTO (para jobs de retry)
   */
  static async retryVideoProcessing(
    videoId: string
  ): Promise<AsyncProcessingResult> {
    try {
      console.log("🔄 [AsyncProcessor] Retrying video processing:", videoId);

      const video = await this.getVideoRecord(videoId);
      if (!video) {
        return {
          success: false,
          error: "Video not found",
          videoId,
          status: "failed",
        };
      }

      // Solo reintentar si está en estado failed por error de Vidu
      if (video.status !== "failed" || !video.error_message?.includes("Vidu")) {
        return {
          success: false,
          error: "Video not eligible for retry",
          videoId,
          status: video.status,
        };
      }

      // Reiniciar estado a pending
      await supabase
        .from("video_generations")
        .update({
          status: "pending",
          error_message: null,
          error_code: null,
          retry_count: (video.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId);

      // Reprocesar
      return await this.processVideoGeneration(videoId, video.prompt);
    } catch (error) {
      console.error("❌ [AsyncProcessor] Retry failed:", error);
      return {
        success: false,
        error: "Retry failed",
        videoId,
        status: "failed",
      };
    }
  }
}
