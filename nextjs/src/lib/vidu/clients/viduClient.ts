// /lib/vidu/clients/viduClient.ts

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
   * ✅ LLAMADA PRINCIPAL A VIDU API (sin cambios en funcionalidad)
   * Solo mejoras en logging y manejo de errores
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

      if (!response.ok) {
        console.error("❌ [ViduClient] API Error:", {
          status: response.status,
          response: responseText,
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
          responseText: responseText.substring(0, 200), // Log parcial
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

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Error calling Vidu API",
      };
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
   * 🚀 NUEVO: EJECUCIÓN ASÍNCRONA PARA EL PROCESADOR
   * Solo envuelve la función existente para uso con AsyncVideoProcessor
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
    // Reutiliza la misma lógica, solo cambia el contexto de uso
    const payload = this.createPayload(refinedPrompt, imageBase64);
    return await this.generateVideo(payload);
  }
}
