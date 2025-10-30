import { NextRequest, NextResponse } from "next/server";
import { CreditsService } from "@/lib/creditsService";
import { authenticateUser } from "@/lib/auth";
import { AsyncVideoProcessor } from "@/lib/vidu/processors/asyncVideoProcessor";
import { ImageProcessor } from "@/lib/vidu/processors/imageProcessor";

interface GenerateRequestBody {
  prompt: string;
  image_base64?: string;
}

interface GenerateResponse {
  success: boolean;
  videoId?: string;
  status?: string;
  creditsBalance?: number;
  message?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // � DIAGNÓSTICO DE ENTORNO (siempre para debugging)
    console.log("🔍 [Generate] Environment check:");
    console.log("🔍 [Generate] NODE_ENV:", process.env.NODE_ENV);
    console.log(
      "🔍 [Generate] OPENAI_API_KEY:",
      process.env.OPENAI_API_KEY ? "✅ Presente" : "❌ Faltante"
    );
    console.log(
      "🔍 [Generate] VIDU_API_KEY:",
      process.env.VIDU_API_KEY ? "✅ Presente" : "❌ Faltante"
    );
    console.log(
      "🔍 [Generate] VIDU_API_URL:",
      process.env.VIDU_API_URL ? "✅ Presente" : "❌ Faltante"
    );
    console.log(
      "🔍 [Generate] NEXT_PUBLIC_SUPABASE_URL:",
      process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Presente" : "❌ Faltante"
    );
    console.log(
      "🔍 [Generate] PRIVATE_SUPABASE_SERVICE_KEY:",
      process.env.PRIVATE_SUPABASE_SERVICE_KEY ? "✅ Presente" : "❌ Faltante"
    );

    // �🔒 1. Autenticar usuario
    const authResult = await authenticateUser(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const userId = authResult.user.id;

    // 2. Parsear y validar request
    const body: GenerateRequestBody = await request.json();
    const { prompt, image_base64 } = body;

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    console.log("🎬 [Generate] Starting video generation:", {
      userId,
      promptLength: prompt.length,
      hasImage: !!image_base64,
    });

    // 2.5. 🔍 VALIDAR CONTENIDO NSFW ANTES DE CONSUMIR CRÉDITOS
    if (image_base64) {
      console.log("🔍 [Generate] Validating image content for NSFW...");
      try {
        const imageResult = await ImageProcessor.processImage(image_base64);
        if (imageResult.nsfwCheck?.isNSFW) {
          console.log("🚫 [Generate] NSFW content detected, rejecting request");
          return NextResponse.json(
            {
              error: `NSFW content detected: ${imageResult.nsfwCheck.reason}`,
            },
            { status: 400 }
          );
        }
        console.log("✅ [Generate] Image content validated successfully");
      } catch (error) {
        console.error("❌ [Generate] Error validating image:", error);
        return NextResponse.json(
          { error: "Error al validar contenido de imagen" },
          { status: 500 }
        );
      }
    }

    // 3. ✅ TRANSACCIÓN ATÓMICA: Crear video + Consumir créditos
    const transactionResult = await CreditsService.createVideoAndConsumeCredits(
      userId,
      prompt,
      image_base64
    );

    if (!transactionResult.success) {
      console.error(
        "❌ [Generate] Transaction failed:",
        transactionResult.error
      );
      return NextResponse.json(
        {
          error: transactionResult.error || "Failed to start generation",
        },
        { status: 400 }
      );
    }

    const { video, balanceAfter } = transactionResult;

    if (!video?.id) {
      console.error("❌ [Generate] No video ID returned from transaction");
      return NextResponse.json(
        { error: "Failed to create video record" },
        { status: 500 }
      );
    }

    // 4. 🚀 PROCESAMIENTO SÍNCRONO INICIAL (validar que Vidu acepta)
    console.log("🚀 [Generate] Starting initial synchronous processing...");
    let taskId: string;

    try {
      const initialResult =
        await AsyncVideoProcessor.processVideoGenerationSync(
          video.id,
          prompt,
          image_base64
        );

      if (!initialResult.success || !initialResult.taskId) {
        console.error(
          "❌ [Generate] Initial processing failed:",
          initialResult.error
        );

        // ❌ REEMBOLSO AUTOMÁTICO por fallo inicial
        await CreditsService.refundForViduFailure(video.id);

        return NextResponse.json(
          {
            error: initialResult.error || "Failed to start video generation",
          },
          { status: 500 }
        );
      }

      taskId = initialResult.taskId;
      console.log("✅ [Generate] Initial processing successful:", {
        videoId: video.id,
        taskId,
      });

      // 🚨 VERIFICACIÓN FINAL: Asegurar que tenemos un taskId válido
      if (!taskId) {
        console.error(
          "🚨 [Generate] CRÍTICO: taskId es undefined después del procesamiento inicial"
        );

        // ❌ REEMBOLSO AUTOMÁTICO por taskId faltante
        await CreditsService.refundForViduFailure(video.id);

        return NextResponse.json(
          { error: "Failed to obtain task ID from Vidu API" },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error("💥 [Generate] Initial processing error:", error);

      // ❌ REEMBOLSO AUTOMÁTICO por error crítico
      await CreditsService.refundForViduFailure(video.id);

      return NextResponse.json(
        { error: "Internal processing error" },
        { status: 500 }
      );
    }

    // 4.5. 🚀 PROCESAMIENTO ASÍNCRONO (monitorear progreso)
    AsyncVideoProcessor.processVideoGeneration(
      video.id,
      taskId,
      prompt,
      image_base64
    )
      .then((result) => {
        if (result.success) {
          console.log(
            "✅ [Generate] Async processing completed for:",
            video.id
          );
        } else {
          console.error("❌ [Generate] Async processing failed:", result.error);
        }
      })
      .catch((error) => {
        console.error("💥 [Generate] Async processing error:", error);
      });

    // 5. 📨 RESPUESTA AL USUARIO (solo si todo está bien)
    const response: GenerateResponse = {
      success: true,
      videoId: video.id,
      status: "processing",
      creditsBalance: balanceAfter,
      message: "Video generation started successfully",
    };

    console.log("✅ [Generate] Request completed successfully:", {
      videoId: video.id,
      creditsBalance: balanceAfter,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("💥 [Generate] Unexpected error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
