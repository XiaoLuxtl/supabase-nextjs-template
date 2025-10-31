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
   * 🚀 PROCESAR GENERACIÓN DE VIDEO SÍNCRONA (VALIDACIÓN INICIAL)
   * Solo valida y llama a Vidu API, sin esperar procesamiento completo
   */
  static async processVideoGenerationSync(
    videoId: string,
    prompt: string,
    imageBase64?: string
  ): Promise<{ success: boolean; taskId?: string; error?: string }> {
    try {
      console.log("🔄 [AsyncProcessor] Starting sync video processing:", {
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
        };
      }

      if (video.status !== "pending") {
        console.warn("⚠️ [AsyncProcessor] Video already processed:", {
          videoId,
          currentStatus: video.status,
          requestedOperation: "processVideoGenerationSync",
        });
        return {
          success: false,
          error: "Video already processed",
        };
      }

      // Avanzamos directamente con el procesamiento
      console.log("🔄 [AsyncProcessor] Proceeding with video generation:", {
        videoId,
        currentStatus: video.status,
        timestamp: new Date().toISOString(),
      });

      // 2. Procesar imagen y refinar prompt si es necesario
      console.log(
        "🎨 [AsyncProcessor] Processing image and refining prompt..."
      );
      console.log("📝 [AsyncProcessor] Original prompt:", prompt);
      console.log("🖼️ [AsyncProcessor] Has image:", !!imageBase64);

      const { refinedPrompt, imageDescription } =
        await this.processImageAndPrompt(prompt, imageBase64);

      console.log("✅ [AsyncProcessor] Refined prompt:", refinedPrompt);
      console.log("📋 [AsyncProcessor] Image description:", imageDescription);

      // 3. Llamar a Vidu API
      console.log("🚀 [AsyncProcessor] Calling Vidu API...");
      console.log("🔗 [AsyncProcessor] Vidu API request details:", {
        promptLength: refinedPrompt.length,
        hasImage: !!imageBase64,
        imageSize: imageBase64
          ? `${(imageBase64.length * 3) / 4 / 1024}KB`
          : "N/A",
      });

      const viduResult = await ViduClient.generateVideoAsync(
        refinedPrompt,
        imageBase64
      );

      console.log("📡 [AsyncProcessor] Vidu API response:", {
        success: viduResult.success,
        hasTaskId: !!viduResult.taskId,
        taskId: viduResult.taskId,
        error: viduResult.error,
      });

      if (!viduResult.success) {
        console.error("❌ [AsyncProcessor] Vidu API failed:", viduResult.error);
        return {
          success: false,
          error: viduResult.error || "Vidu API failed",
        };
      }

      if (!viduResult.taskId) {
        console.error(
          "❌ [AsyncProcessor] Vidu API returned success but no taskId:",
          viduResult
        );
        return {
          success: false,
          error: "Vidu API returned success but no task_id",
        };
      }

      // 4. Actualizar registro con datos de Vidu y marcar como processing
      const { error: updateError } = await supabase
        .from("video_generations")
        .update({
          status: "processing",
          vidu_task_id: viduResult.taskId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", videoId);

      if (updateError) {
        console.error("❌ [AsyncProcessor] Failed to update video status:", {
          videoId,
          error: updateError.message,
        });
        return {
          success: false,
          error: "Failed to update video status",
        };
      }

      console.log("✅ [AsyncProcessor] Video processing started:", {
        videoId,
        taskId: viduResult.taskId,
        status: "processing",
      });

      return {
        success: true,
        taskId: viduResult.taskId,
      };
    } catch (error) {
      console.error("❌ [AsyncProcessor] Sync processing failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * 🎯 PROCESAMIENTO ASÍNCRONO PRINCIPAL
   * Monitorea el progreso de Vidu y actualiza la BD cuando esté completo
   * Asume que la validación inicial ya se hizo en processVideoGenerationSync
   */
  static async processVideoGeneration(
    videoId: string,
    taskId: string,
    prompt: string,
    imageBase64?: string
  ): Promise<AsyncProcessingResult> {
    try {
      console.log("🔄 [AsyncProcessor] Starting async monitoring:", {
        videoId,
        taskId,
        promptLength: prompt.length,
        hasImage: !!imageBase64,
      });

      // 1. Verificar que el video existe
      const video = await this.getVideoRecord(videoId);
      if (!video) {
        return {
          success: false,
          error: "Video record not found",
          videoId,
          status: "failed",
        };
      }

      // 2. Procesar imagen y refinar prompt si es necesario
      console.log(
        "🎨 [AsyncProcessor] Processing image and refining prompt..."
      );
      console.log("📝 [AsyncProcessor] Original prompt:", prompt);
      console.log("🖼️ [AsyncProcessor] Has image:", !!imageBase64);

      const { refinedPrompt, imageDescription } =
        await this.processImageAndPrompt(prompt, imageBase64);

      console.log("✅ [AsyncProcessor] Refined prompt:", refinedPrompt);
      console.log("📋 [AsyncProcessor] Image description:", imageDescription);

      // 3. Llamar a Vidu API
      console.log("🚀 [AsyncProcessor] Calling Vidu API...");
      console.log("🔗 [AsyncProcessor] Vidu API request details:", {
        promptLength: refinedPrompt.length,
        hasImage: !!imageBase64,
        imageSize: imageBase64
          ? `${(imageBase64.length * 3) / 4 / 1024}KB`
          : "N/A",
      });

      const viduResult = await ViduClient.generateVideoAsync(
        refinedPrompt,
        imageBase64
      );

      console.log("📡 [AsyncProcessor] Vidu API response:", {
        success: viduResult.success,
        hasTaskId: !!viduResult.taskId,
        error: viduResult.error,
      });

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

      // Reprocesar con nueva llamada inicial (sin imagen ya que debería estar procesada)
      const retryResult = await this.processVideoGenerationSync(
        videoId,
        video.prompt
      );
      if (!retryResult.success || !retryResult.taskId) {
        return {
          success: false,
          error: retryResult.error || "Retry failed",
          videoId,
          status: "failed",
        };
      }
      // Continuar monitoreando con el nuevo taskId
      return await this.processVideoGeneration(
        videoId,
        retryResult.taskId,
        video.prompt
      );
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
