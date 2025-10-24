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
  static async generateVideo(payload: ViduPayload): Promise<{
    success: boolean;
    taskId?: string;
    data?: ViduResponse;
    error?: string;
  }> {
    try {
      const response = await fetch(process.env.VIDU_API_URL!, {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.VIDU_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      console.log("Vidu response status:", response.status);
      console.log("Vidu raw response:", responseText);

      if (!response.ok) {
        return {
          success: false,
          error: `Vidu API error: ${responseText}`,
        };
      }

      try {
        const viduData: ViduResponse = JSON.parse(responseText);
        const taskId = viduData.task_id?.toString();

        if (!taskId) {
          return {
            success: false,
            error: "No task_id in Vidu response",
          };
        }

        return {
          success: true,
          taskId,
          data: viduData,
        };
      } catch (parseError) {
        console.error("Failed to parse Vidu response:", parseError);
        return {
          success: false,
          error: "Invalid Vidu response format",
        };
      }
    } catch (error) {
      console.error("Error calling Vidu API:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Error calling Vidu API",
      };
    }
  }

  static createPayload(
    refinedPrompt: string,
    imageBase64?: string,
    callbackUrl?: string
  ): ViduPayload {
    return {
      model: "viduq1",
      images: imageBase64 ? [`data:image/jpeg;base64,${imageBase64}`] : [],
      prompt: refinedPrompt,
      duration: 5,
      resolution: "1080p",
      callback_url:
        callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/vidu/webhook`,
    };
  }
}
