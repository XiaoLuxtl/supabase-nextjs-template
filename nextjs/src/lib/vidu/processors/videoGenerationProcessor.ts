import { createClient } from "@supabase/supabase-js";
import { ViduClient } from "../clients/viduClient";
import { CreditsService } from "@/lib/creditsService";
import { ImageProcessor } from "./imageProcessor";
import { Database, Json } from "@/types/database.types";

// Tipos de Supabase para la tabla 'video_generations'
type VideoGenerationRecord =
  Database["public"]["Tables"]["video_generations"]["Row"];
type VideoGenerationUpdate =
  Database["public"]["Tables"]["video_generations"]["Update"];
// Tipo para la columna vidu_full_response (asumido como Json de Supabase)
// Asumiendo que ViduClient.generateVideo retorna un objeto con un campo 'data' (la respuesta completa)
// y 'taskId', con 'success' y 'error'.
interface ViduResponse {
  success: boolean;
  taskId?: string;
  data?: object | null; // El tipo para vidu_full_response (se usará Json | undefined para la columna de Supabase)
  error?: string;
}

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

interface AsyncProcessingResult {
  success: boolean;
  error?: string;
  videoId: string;
  status: "pending" | "processing" | "completed" | "failed"; // Tipos de estado más estrictos
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

      // CORRECCIÓN TS 2322 (Línea 58): video.status puede ser 'string | null'
      if (video.status !== "pending" && video.status !== null) {
        console.warn("⚠️ Video already processed:", video.status);
        // Si no está en pending, se asume que el status existente es el correcto
        return {
          success: true,
          videoId,
          // Se usa un 'as' de aserción para asegurar el tipo, ya que la lógica superior lo verifica
          status: video.status as AsyncProcessingResult["status"],
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
      // Forzar tipado para ViduClient.generateVideo si no está tipado
      const viduResult: ViduResponse = await ViduClient.generateVideo(
        ViduClient.createPayload(refinedPrompt, imageBase64)
      );

      // CORRECCIÓN TS 2345 (Línea 81): viduResult.error puede ser undefined
      if (!viduResult.success || !viduResult.taskId) {
        console.error("❌ [AsyncProcessor] Vidu API failed:", viduResult.error);

        // Se usa el operador nullish coalescing (??) para asegurar que se pasa un string
        await this.handleViduFailure(
          videoId,
          viduResult.error ?? "Vidu API returned an unknown error"
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
      // CORRECCIÓN TS 2345 (Línea 97): viduResult.data puede ser 'undefined'
      await this.updateWithViduSuccess(
        videoId,
        viduResult.taskId,
        viduResult.data ?? null, // Aseguramos que sea 'object | null' para el parámetro
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

      return {
        success: false,
        error: "Unexpected processing error",
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
    let refinedPrompt = prompt; // Sonarlint S1854: Mantener, ya que se usa en el bloque catch

    try {
      if (imageBase64) {
        console.log("🖼️ [AsyncProcessor] Processing image...");

        const imageResult = await ImageProcessor.processImage(imageBase64);

        // Validar contenido NSFW
        if (imageResult.nsfwCheck?.isNSFW) {
          throw new Error(
            `NSFW content detected: ${imageResult.nsfwCheck.reason}`
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
        // Aún se refina el prompt, aunque no haya imagen
        refinedPrompt = await ImageProcessor.refinePrompt(
          prompt,
          imageDescription
        );
      }

      return { refinedPrompt, imageDescription };
    } catch (error) {
      console.error("❌ [AsyncProcessor] Image processing failed:", error);
      // Si falla el procesamiento de imagen, retornar el prompt original
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
      // CORRECCIÓN TS 2551 (Línea 242): Error tipográfico de 'Oerror' a 'error'
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
          // Se asume que tienes una columna para el estado de reembolso
          credits_refunded: refundSuccess,
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
    viduData: object | null,
    refinedPrompt: string
  ): Promise<void> {
    try {
      // CORRECCIÓN TS 2322 (Línea 324): Asignar 'object | null' a 'Json | undefined'
      // Ya que viduData es 'object | null', la columna `vidu_full_response` de tipo Json (o JSONB) en Supabase
      // generalmente acepta `object | null` en TypeScript, pero el tipo `Json` en `database.types` puede ser más restrictivo.
      // Se utiliza una aserción de tipo para asegurar que TS lo acepte, asumiendo que el tipo `Json`
      // de tu base de datos puede ser compatible con `object | null`.
      const updateData: Partial<VideoGenerationUpdate> = {
        status: "processing",
        vidu_task_id: taskId,
        translated_prompt_en: refinedPrompt,
        // Forzamos el tipado para compatibilidad con la definición de Supabase
        vidu_full_response: viduData as Json | null | undefined,
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
      await this.handleViduFailure(videoId, "Failed to update video record");
      throw error;
    }
  }

  /**
   * 📋 OBTENER REGISTRO DE VIDEO
   */
  private static async getVideoRecord(
    videoId: string
  ): Promise<VideoGenerationRecord | null> {
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

      // CORRECCIÓN TS 415 (Línea 415): Se debe devolver el objeto completo, no un estado de string
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

      // CORRECCIÓN TS 2322 (Línea 415): video.status puede ser 'string | null'
      const videoStatus = video.status || "pending";

      const isViduFailure = video.error_message?.includes("Vidu");
      const isEligibleForRetry = videoStatus === "failed" && isViduFailure;

      if (!isEligibleForRetry) {
        return {
          success: false,
          error: "Video not eligible for retry",
          videoId,
          // Se usa un 'as' de aserción ya que el tipo 'string | null' del video no es compatible con AsyncProcessingResult["status"]
          status: videoStatus as AsyncProcessingResult["status"],
        };
      }

      // Reiniciar estado a pending
      const { error: updateError } = await supabase
        .from("video_generations")
        .update({
          status: "pending",
          error_message: null,
          error_code: null,
          retry_count: (video.retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
          credits_refunded: false,
        })
        .eq("id", videoId);

      if (updateError) {
        throw new Error(
          `Failed to reset video status for retry: ${updateError.message}`
        );
      }

      // Reprocesar
      // CORRECCIÓN Sonarlint S4623 (Línea 451): Se elimina el 'undefined' redundante
      return await this.processVideoGeneration(
        videoId,
        video.prompt
        // Se asume que no se necesita `imageBase64` ya que no está en el registro
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
