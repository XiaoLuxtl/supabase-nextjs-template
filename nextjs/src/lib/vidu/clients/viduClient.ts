// /lib/vidu/clients/viduClient.ts
import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase para logging (usa service_role)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

interface ViduPayload {
  model: string;
  images: string[];
  prompt: string;
  duration: number;
  resolution: string;
  callback_url: string;
}

interface ViduResponse {
  task_id?: string;
  [key: string]: unknown;
}

export class ViduClient {
  /**
   * ✅ LLAMADA PRINCIPAL A VIDU API CON LOGGING MEJORADO
   */
  static async generateVideo(payload: ViduPayload): Promise<{
    success: boolean;
    taskId?: string;
    data?: ViduResponse;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      console.log("🚀 [ViduClient] Calling Vidu API...", {
        promptLength: payload.prompt.length,
        hasImages: payload.images.length > 0,
        duration: payload.duration,
      });

      const response = await fetch(process.env.VIDU_API_URL!, {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.VIDU_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseTime = Date.now() - startTime;
      const responseText = await response.text();

      console.log("📨 [ViduClient] API Response:", {
        status: response.status,
        responseTime: `${responseTime}ms`,
        responseLength: responseText.length,
      });

      // ✅ LOGGEAR ERRORES DE API
      if (!response.ok) {
        console.error("❌ [ViduClient] API Error:", {
          status: response.status,
          response: responseText,
        });

        // 🔒 GUARDAR LOG DEL ERROR EN LA BASE DE DATOS
        await this.logApiError({
          status: response.status,
          error: responseText,
          payload: payload,
          responseTime: responseTime,
        });

        return {
          success: false,
          error: `Vidu API error (${response.status}): ${responseText}`,
        };
      }

      try {
        const viduData: ViduResponse = JSON.parse(responseText);
        const taskId = viduData.task_id?.toString();

        if (!taskId) {
          console.error("❌ [ViduClient] No task_id in response:", viduData);

          // 🔒 GUARDAR LOG DE ERROR DE FORMATO
          await this.logApiError({
            status: response.status,
            error: "No task_id in Vidu response",
            payload: payload,
            responseTime: responseTime,
            viduData: viduData,
          });

          return {
            success: false,
            error: "No task_id in Vidu response",
          };
        }

        console.log("✅ [ViduClient] API Success:", {
          taskId,
          responseTime: `${responseTime}ms`,
        });

        return {
          success: true,
          taskId,
          data: viduData,
        };
      } catch (parseError) {
        console.error("❌ [ViduClient] Parse Error:", {
          error: parseError,
          responseText: responseText.substring(0, 200),
        });

        // 🔒 GUARDAR LOG DE ERROR DE PARSING
        await this.logApiError({
          status: response.status,
          error: `Parse error: ${parseError}`,
          payload: payload,
          responseTime: responseTime,
          responseText: responseText.substring(0, 500),
        });

        return {
          success: false,
          error: "Invalid Vidu response format",
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error("💥 [ViduClient] Network Error:", {
        error: error instanceof Error ? error.message : String(error),
        responseTime: `${responseTime}ms`,
      });

      // 🔒 GUARDAR LOG DE ERROR DE RED
      await this.logApiError({
        status: 0, // 0 indica error de red
        error: error instanceof Error ? error.message : String(error),
        payload: payload,
        responseTime: responseTime,
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Error calling Vidu API",
      };
    }
  }

  /**
   * 🔒 GUARDAR LOGS DE ERRORES DE API
   */
  private static async logApiError(errorInfo: {
    status: number;
    error: string;
    payload: ViduPayload;
    responseTime: number;
    viduData?: ViduResponse;
    responseText?: string;
  }) {
    try {
      const { error: logError } = await supabase
        .from("vidu_webhook_logs")
        .insert({
          vidu_task_id: null, // No hay task_id porque falló antes del procesamiento
          payload: {
            api_call_error: true,
            status_code: errorInfo.status,
            error_message: errorInfo.error.substring(0, 1000), // Limitar tamaño
            response_time_ms: errorInfo.responseTime,
            timestamp: new Date().toISOString(),
            // Información del payload (limitada por seguridad)
            prompt_preview: errorInfo.payload.prompt?.substring(0, 200),
            has_images: errorInfo.payload.images.length > 0,
            image_count: errorInfo.payload.images.length,
            model: errorInfo.payload.model,
            duration: errorInfo.payload.duration,
            // Información adicional si existe
            ...(errorInfo.viduData && { vidu_response: errorInfo.viduData }),
            ...(errorInfo.responseText && {
              response_preview: errorInfo.responseText,
            }),
          },
          processed: true, // No necesita procesamiento adicional
          received_at: new Date().toISOString(),
          error_type:
            errorInfo.status === 0
              ? "network_error"
              : errorInfo.status === 403
              ? "api_403_forbidden"
              : errorInfo.status === 429
              ? "api_429_ratelimit"
              : "api_error",
        });

      if (logError) {
        console.error(
          "❌ [ViduClient] Failed to save API error log:",
          logError
        );
      } else {
        console.log("✅ [ViduClient] API error logged successfully");
      }
    } catch (err) {
      console.error("💥 [ViduClient] Exception logging API error:", err);
    }
  }

  /**
   * ✅ CREAR PAYLOAD (sin cambios)
   */
  static createPayload(
    refinedPrompt: string,
    imageBase64?: string,
    callbackUrl?: string
  ): ViduPayload {
    const payload = {
      model: "viduq1",
      images: imageBase64 ? [`data:image/jpeg;base64,${imageBase64}`] : [],
      prompt: refinedPrompt,
      duration: 5,
      resolution: "1080p",
      callback_url:
        callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/vidu/webhook`,
    };

    console.log("📦 [ViduClient] Created payload:", {
      promptLength: refinedPrompt.length,
      hasImage: !!imageBase64,
      callbackUrl: payload.callback_url,
    });

    return payload;
  }

  /**
   * 🚀 EJECUCIÓN ASÍNCRONA (sin cambios)
   */
  static async generateVideoAsync(
    refinedPrompt: string,
    imageBase64?: string
  ): Promise<{
    success: boolean;
    taskId?: string;
    data?: ViduResponse;
    error?: string;
  }> {
    const payload = this.createPayload(refinedPrompt, imageBase64);
    return await this.generateVideo(payload);
  }
}
