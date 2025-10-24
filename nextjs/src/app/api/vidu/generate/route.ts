import { NextRequest, NextResponse } from "next/server";
import { ValidationService } from "@/lib/vidu/security/validationService";
import { ImageProcessor } from "@/lib/vidu/processors/imageProcessor";
import { VideoGenerationProcessor } from "@/lib/vidu/processors/videoGenerationProcessor";
import { ViduClient } from "@/lib/vidu/clients/viduClient";
import { ErrorHandler } from "@/lib/vidu/utils/errorHandler";
import {
  VideoGenerationRequest,
  VideoGenerationResult,
  ViduApiResponse,
} from "@/lib/vidu/types/viduTypes";
import { CreditsService } from "@/lib/creditsService";
import { authenticateUser } from "@/lib/auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: VideoGenerationRequest;

  try {
    // 🔒 0. Autenticar usuario
    const authResult = await authenticateUser(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const authenticatedUserId = authResult.user.id;

    // 1. Intentar parsear el body de forma segura
    const requestBody = await request.text();

    if (!requestBody || requestBody.trim() === "") {
      return NextResponse.json(
        { error: "Request body está vacío" },
        { status: 400 }
      );
    }

    try {
      body = JSON.parse(requestBody) as VideoGenerationRequest;
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      return NextResponse.json(
        { error: "Formato JSON inválido en el request body" },
        { status: 400 }
      );
    }

    const { image_base64, prompt: userPrompt } = body;

    console.log("=== VIDU GENERATE REQUEST ===");
    console.log("User ID:", authenticatedUserId);
    console.log("Prompt length:", userPrompt?.length);
    console.log("Image base64 length:", image_base64?.length);

    // 2. Validar request básico
    console.log("--- STEP 2: Validating request ---");
    const requestValidation = ValidationService.validateRequest(body);
    console.log("Request validation result:", requestValidation);
    if (!requestValidation.isValid) {
      console.log("❌ Request validation failed:", requestValidation.error);
      return NextResponse.json(
        { error: requestValidation.error },
        { status: 400 }
      );
    }
    console.log("✅ Request validation passed");
    console.log("--- STEP 2 ---");

    // 3. Validar créditos del usuario
    console.log("--- STEP 3: Validating credits ---");
    const creditValidation = await ValidationService.validateUserCredits(
      authenticatedUserId
    );
    console.log("Credit validation result:", creditValidation);
    if (!creditValidation.isValid) {
      console.log("❌ Credit validation failed:", creditValidation.error);
      const status =
        creditValidation.error === "Créditos insuficientes" ? 402 : 404;
      return NextResponse.json({ error: creditValidation.error }, { status });
    }
    console.log(
      "✅ Credit validation passed, balance:",
      creditValidation.currentBalance
    );
    console.log("--- STEP 3 ---");

    // 4. Procesar imagen (si existe)
    console.log("--- STEP 4: Processing image ---");
    let imageDescription = "ninguna imagen proporcionada";
    if (image_base64) {
      console.log("Processing image, base64 length:", image_base64.length);
      try {
        const imageResult = await ImageProcessor.processImage(image_base64);
        console.log("Image processing result:", {
          hasDescription: !!imageResult.imageDescription,
          nsfwCheck: imageResult.nsfwCheck,
        });

        if (imageResult.nsfwCheck?.isNSFW) {
          console.log(
            "❌ NSFW content detected:",
            imageResult.nsfwCheck.reason
          );
          return NextResponse.json(
            {
              error: `Contenido no permitido: ${
                imageResult.nsfwCheck.reason || "Imagen inapropiada"
              }`,
              code: "NSFW_CONTENT",
            },
            { status: 400 }
          );
        }

        imageDescription = imageResult.imageDescription;
        console.log("✅ Image processing completed");
      } catch (error) {
        console.log("❌ Image processing error:", error);
        return NextResponse.json(
          { error: "Error al procesar la imagen" },
          { status: 400 }
        );
      }
    } else {
      console.log("No image provided, skipping image processing");
    }
    console.log("--- STEP 4 ---");

    // 5. Refinar prompt
    const refinedPrompt = await ImageProcessor.refinePrompt(
      userPrompt,
      imageDescription
    );
    console.log("--- STEP 5 ---");

    // 6. Crear registro de generación
    const generationResult =
      await VideoGenerationProcessor.createGenerationRecord(
        authenticatedUserId,
        userPrompt,
        refinedPrompt
      );

    if (!generationResult.success || !generationResult.generation) {
      return NextResponse.json(
        { error: generationResult.error || "Error al crear generación" },
        { status: 500 }
      );
    }

    const generation = generationResult.generation;

    console.log("--- STEP 6 ---");

    // 7. ✅ CONSUMIR CRÉDITOS DE FORMA SEGURA
    const creditResult = await CreditsService.consumeCreditsForVideo(
      authenticatedUserId,
      generation.id
    );

    if (!creditResult.success) {
      await VideoGenerationProcessor.markAsFailed(
        generation.id,
        `Error al consumir créditos: ${creditResult.error}`
      );
      return NextResponse.json(
        { error: creditResult.error || "Error al consumir créditos" },
        { status: 500 }
      );
    }

    console.log(`✅ Créditos consumidos: ${creditResult.newBalance} restantes`);
    console.log("--- STEP 7 ---");

    // 8. Verificar que los créditos se consumieron correctamente
    const updatedBalance = await CreditsService.getBalance(authenticatedUserId);
    const initialBalance = creditValidation.currentBalance;

    if (updatedBalance >= initialBalance) {
      console.error(
        `❌ FAILSAFE: Créditos no bajaron! Inicial: ${initialBalance}, Actual: ${updatedBalance}`
      );

      await CreditsService.refundVideoCredits(generation.id);
      await VideoGenerationProcessor.markAsFailed(
        generation.id,
        `Failsafe activado: créditos no bajaron (inicial: ${initialBalance}, actual: ${updatedBalance})`
      );

      return NextResponse.json(
        {
          error:
            "Error en consumo de créditos (failsafe activado, no se descontó crédito)",
        },
        { status: 500 }
      );
    }

    console.log(
      `✅ Créditos consumidos correctamente (${initialBalance} → ${updatedBalance})`
    );
    console.log("--- STEP 8 ---");

    // 9. Llamar a Vidu API
    const viduPayload = ViduClient.createPayload(refinedPrompt, image_base64);
    const viduResult = await ViduClient.generateVideo(viduPayload);

    if (!viduResult.success || !viduResult.taskId) {
      // ✅ REEMBOLSAR usando el servicio unificado
      await CreditsService.refundVideoCredits(generation.id);
      await VideoGenerationProcessor.markAsFailed(
        generation.id,
        viduResult.error || "Error en Vidu API"
      );

      return NextResponse.json({
        success: false,
        error: viduResult.error,
        updatedCredits: creditResult.newBalance, // Ya reembolsado
      });
    }
    console.log("--- STEP 9 ---");

    // 10. Actualizar generación con datos de Vidu
    // Crear datos seguros para Vidu
    const safeViduData = {
      taskId: viduResult.taskId,
      creationId: (viduResult.data as ViduApiResponse)?.task_id, // Mapear task_id a creationId si es necesario
      status: "processing",
      rawResponse: viduResult.data, // Guardar la respuesta completa
      timestamp: new Date().toISOString(),
    };

    const updateResult = await VideoGenerationProcessor.updateWithViduData(
      generation.id,
      viduResult.taskId,
      safeViduData // ← Ahora es un objeto válido
    );

    if (!updateResult.success) {
      // Aunque Vidu fue exitoso, si no podemos actualizar la BD, reembolsamos
      await CreditsService.refundVideoCredits(generation.id);
      return NextResponse.json({
        success: false,
        error: "Error actualizando generación",
        updatedCredits: updatedBalance,
      });
    }
    console.log("--- STEP 10 ---");

    // 11. ÉXITO
    const result: VideoGenerationResult = {
      success: true,
      generation: updateResult.generation,
      updatedCredits: updatedBalance,
      message: "Video en proceso de generación",
    };

    return NextResponse.json(result);
  } catch (error) {
    ErrorHandler.logError("VIDU GENERATE", error);
    const errorInfo = ErrorHandler.handleError(error);

    return NextResponse.json(
      { error: errorInfo.message, details: errorInfo.details },
      { status: 500 }
    );
  }
}

// También agreguemos un método GET para debugging
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    message: "Generate API está funcionando",
    usage:
      "Envía un POST con { prompt: string, image_base64?: string } (autenticación requerida)",
    required_fields: ["prompt"],
    optional_fields: ["image_base64"],
  });
}
