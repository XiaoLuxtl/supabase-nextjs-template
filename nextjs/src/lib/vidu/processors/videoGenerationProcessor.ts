// /lib/vidu/processors/videoGenerationProcessor.ts
import { createClient } from "@supabase/supabase-js";
import { VideoGenerationData } from "../types/viduTypes";
import { Database, Json } from "@/types/database.types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

interface GenerationCreationResult {
  success: boolean;
  generation?: VideoGenerationData;
  error?: string;
}

interface GenerationUpdateResult {
  success: boolean;
  generation?: VideoGenerationData;
  error?: string;
}

// Tipo para los datos de actualización de video_generations
type VideoGenerationUpdate = Partial<
  Database["public"]["Tables"]["video_generations"]["Update"]
>;

// Tipo para la respuesta de Vidu
interface ViduResponseData {
  taskId?: string;
  creationId?: string;
  status?: string;
  [key: string]: unknown;
}

export class VideoGenerationProcessor {
  static async createGenerationRecord(
    userId: string,
    userPrompt: string,
    refinedPrompt: string
  ): Promise<GenerationCreationResult> {
    try {
      const videoData: Database["public"]["Tables"]["video_generations"]["Insert"] =
        {
          user_id: userId,
          prompt: userPrompt,
          translated_prompt_en: refinedPrompt,
          model: "viduq1",
          duration: 5,
          aspect_ratio: "16:9",
          resolution: "1080p",
          vidu_task_id: null,
          vidu_creation_id: null,
          status: "pending",
          credits_used: 0,
          video_url: null,
          cover_url: null,
          video_duration_actual: null,
          video_fps: null,
          bgm: false,
          error_message: null,
          error_code: null,
          retry_count: 0,
          max_retries: 3,
          vidu_full_response: null,
          created_at: new Date().toISOString(),
          started_at: null,
          completed_at: null,
        };

      const { data: generation, error } = await supabase
        .from("video_generations")
        .insert(videoData)
        .select()
        .single();

      if (error) {
        console.error("Error creating generation record:", error);
        return {
          success: false,
          error: `Error de base de datos: ${error.message}`,
        };
      }

      if (!generation) {
        return {
          success: false,
          error: "No se pudo crear el registro de generación",
        };
      }

      return { success: true, generation };
    } catch (error) {
      console.error("Unexpected error creating generation record:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      };
    }
  }

  static async markAsFailed(
    videoId: string,
    errorMessage: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: VideoGenerationUpdate = {
        status: "failed",
        error_message: errorMessage,
        credits_used: 0,
        // updated_at: new Date().toISOString(), // Descomentar si existe en la tabla
      };

      const { error } = await supabase
        .from("video_generations")
        .update(updateData)
        .eq("id", videoId);

      if (error) {
        console.error("Error marking video as failed:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Unexpected error marking video as failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      };
    }
  }

  static async updateWithViduData(
    videoId: string,
    taskId: string,
    viduData: ViduResponseData
  ): Promise<GenerationUpdateResult> {
    try {
      const updateData: VideoGenerationUpdate = {
        vidu_task_id: taskId,
        status: "processing",
        started_at: new Date().toISOString(),
        vidu_full_response: viduData as Json, // Cast a Json type si es necesario
        credits_used: 1,
        // updated_at: new Date().toISOString(), // Descomentar si existe en la tabla
      };

      const { data: updatedGeneration, error } = await supabase
        .from("video_generations")
        .update(updateData)
        .eq("id", videoId)
        .select()
        .single();

      if (error) {
        console.error("Error updating generation with Vidu data:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      if (!updatedGeneration) {
        return {
          success: false,
          error: "No se pudo actualizar la generación",
        };
      }

      return { success: true, generation: updatedGeneration };
    } catch (error) {
      console.error("Unexpected error updating generation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      };
    }
  }
}
