// src/app/api/vidu/webhook/route.ts - VERSIÓN CORREGIDA

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { refundAndMarkFailed } from "@/lib/refund-helper";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

interface ViduWebhookPayload {
  id: string;
  state: string;
  bgm?: boolean;
  credits?: number;
  payload?: string;
  err_code?: string;
  off_peak?: boolean;
  creations?: Array<{
    id: string;
    url: string;
    video?: {
      fps?: number;
      duration?: number;
      resolution?: string | null;
    };
    cover_url?: string;
    moderation_url?: string[];
    watermarked_url?: string;
  }>;
  error?: string;
}

/**
 * ✅ ACTUALIZAR CONTADOR DE VIDEOS DEL USUARIO
 */
async function updateUserVideoCount(userId: string) {
  try {
    const { data, error } = await supabase.rpc("increment_user_video_count", {
      user_id: userId,
    });

    if (error) {
      console.error(`   ❌ Error incrementando contador:`, error);
      return false;
    }

    if (data && data.success) {
      console.log(`   ✅ Contador incrementado:`, {
        user_id: userId,
        old_count: data.old_count,
        new_count: data.new_count,
      });
      return true;
    } else {
      console.error(`   ❌ Error en increment_user_video_count:`, data?.error);
      return false;
    }
  } catch (error) {
    console.error(`   ❌ Error en updateUserVideoCount:`, error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  let body: ViduWebhookPayload | null = null;

  try {
    body = (await request.json()) as ViduWebhookPayload;

    console.log("🔗 [Webhook] Received:", {
      taskId: body.id,
      state: body.state,
      hasCreations: !!body.creations?.length,
      creationCount: body.creations?.length || 0,
      timestamp: new Date().toISOString(),
    });

    // 🔍 BUSCAR LA GENERACIÓN POR TASK_ID (ESENCIAL - AL INICIO)
    const { data: generation, error: findError } = await supabase
      .from("video_generations")
      .select("*")
      .eq("vidu_task_id", body.id)
      .single();

    console.log("🔍 [Webhook] Generation lookup result:", {
      found: !!generation,
      generationId: generation?.id,
      userId: generation?.user_id,
      currentStatus: generation?.status,
      error: findError?.message,
    });

    // Guardar webhook log (incluyendo user_id si existe)
    const { error: logError } = await supabase
      .from("vidu_webhook_logs")
      .insert({
        vidu_task_id: body.id,
        user_id: generation?.user_id || null, // ✅ GUARDAR USER_ID SI EXISTE
        payload: body,
        processed: false,
        received_at: new Date().toISOString(),
      });

    if (logError) {
      console.error("❌ [Webhook] Error logging webhook:", logError);
    }

    // ❌ SI NO ENCONTRAMOS LA GENERACIÓN, NO PODEMOS PROCESAR
    if (findError || !generation) {
      console.error(
        "❌ [Webhook] Generation not found for task:",
        body.id,
        findError
      );

      await supabase
        .from("vidu_webhook_logs")
        .update({
          processed: true,
          error_message: "Generation not found for taskId",
          error_type: "GENERATION_NOT_FOUND",
        })
        .eq("vidu_task_id", body.id);

      return NextResponse.json(
        { error: "Generation not found" },
        { status: 404 }
      );
    }

    // ✅ AHORA TENEMOS generation.user_id DISPONIBLE PARA TODOS LOS ESTADOS

    // Manejar estado "failed"
    if (body.state === "failed") {
      console.log("❌ [Webhook] Processing 'failed' state for task:", body.id);

      const isNSFWError =
        body.error?.toLowerCase().includes("nsfw") ||
        body.error?.toLowerCase().includes("inappropriate") ||
        body.error?.toLowerCase().includes("adult content");

      const { error: updateError } = await supabase
        .from("video_generations")
        .update({
          status: "failed",
          error_code: isNSFWError ? "NSFW_CONTENT" : "VIDU_ERROR",
          error_message: isNSFWError
            ? "Contenido no permitido: La imagen contiene contenido inapropiado"
            : body.error || "Error en la generación del video",
          completed_at: new Date().toISOString(),
          vidu_full_response: body,
        })
        .eq("id", generation.id);

      if (updateError) {
        console.error(
          "❌ [Webhook] Error updating generation to failed:",
          updateError
        );
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }

      if (isNSFWError) {
        // ✅ AHORA TENEMOS EL USER_ID PARA EL REEMBOLSO
        const refundResult = await refundAndMarkFailed(
          generation.id,
          generation.user_id, // ✅ USER_ID DISPONIBLE
          "NSFW content detected by Vidu"
        );

        if (refundResult.success) {
          console.log(
            "✅ [Webhook] NSFW refund processed, new balance:",
            refundResult.newBalance
          );
        } else {
          console.error("❌ [Webhook] NSFW refund failed:", refundResult.error);
        }
      }

      await supabase
        .from("vidu_webhook_logs")
        .update({ processed: true })
        .eq("vidu_task_id", body.id);

      return NextResponse.json({
        received: true,
        error: body.error,
        user_id: generation.user_id, // ✅ INCLUIR USER_ID EN RESPUESTA
      });
    }

    // Handle "created" state
    if (body.state === "created") {
      console.log("🔄 [Webhook] Processing 'created' state for task:", body.id);

      if (generation.status !== "pending" && generation.status !== "queued") {
        const { error: updateError } = await supabase
          .from("video_generations")
          .update({
            status: "pending",
            vidu_full_response: body,
            updated_at: new Date().toISOString(),
          })
          .eq("id", generation.id);

        if (updateError) {
          console.error(
            "❌ [Webhook] Error updating generation to pending:",
            updateError
          );
          return NextResponse.json({ error: "Update failed" }, { status: 500 });
        }
      }

      await supabase
        .from("vidu_webhook_logs")
        .update({ processed: true })
        .eq("vidu_task_id", body.id);

      console.log("✅ [Webhook] Task marked as pending:", generation.id);
      return NextResponse.json({
        received: true,
        processed: true,
        generation_id: generation.id,
        user_id: generation.user_id, // ✅ INCLUIR USER_ID EN RESPUESTA
      });
    }

    // Handle "success" state
    if (body.state === "success") {
      console.log("✅ [Webhook] Processing 'success' state for task:", body.id);
      const creation = body.creations?.[0];

      console.log("📊 [Webhook] Success data:", {
        taskId: body.id,
        hasCreation: !!creation,
        creationId: creation?.id,
        videoUrl: creation?.url,
        coverUrl: creation?.cover_url,
        userId: generation.user_id,
      });

      if (!creation) {
        console.error("❌ [Webhook] Invalid webhook data: missing creations");
        return NextResponse.json({ error: "Invalid data" }, { status: 400 });
      }

      const { error: updateError } = await supabase
        .from("video_generations")
        .update({
          status: "completed",
          vidu_creation_id: creation.id,
          video_url: creation.url,
          cover_url: creation.cover_url,
          video_duration_actual: creation.video?.duration || 0,
          video_fps: creation.video?.fps || 0,
          bgm: body.bgm || false,
          completed_at: new Date().toISOString(),
          vidu_full_response: body,
        })
        .eq("id", generation.id);

      if (updateError) {
        console.error(
          "❌ [Webhook] Error updating generation to completed:",
          updateError
        );

        await supabase
          .from("vidu_webhook_logs")
          .update({
            processed: true,
            error_message: `Update failed: ${updateError.message}`,
            error_type: "UPDATE_ERROR",
          })
          .eq("vidu_task_id", body.id);

        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }

      // ✅ ACTUALIZAR CONTADOR DE VIDEOS DEL USUARIO
      await updateUserVideoCount(generation.user_id);

      // Marcar webhook como procesado exitosamente
      const { error: logUpdateError } = await supabase
        .from("vidu_webhook_logs")
        .update({ processed: true })
        .eq("vidu_task_id", body.id);

      if (logUpdateError) {
        console.error(
          "❌ [Webhook] Error updating webhook log:",
          logUpdateError
        );
      }

      console.log("✅ [Webhook] Video generation completed:", {
        generationId: generation.id,
        userId: generation.user_id,
        videoUrl: creation.url,
      });

      return NextResponse.json({
        received: true,
        processed: true,
        generation_id: generation.id,
        user_id: generation.user_id, // ✅ INCLUIR USER_ID EN RESPUESTA
      });
    }

    // Handle other states (e.g., "queueing", "processing")
    console.log("⚠️ [Webhook] State not handled:", body.state);

    // Marcar como procesado incluso para estados no manejados
    await supabase
      .from("vidu_webhook_logs")
      .update({
        processed: true,
        error_message: `Unhandled state: ${body.state}`,
        error_type: "UNHANDLED_STATE",
      })
      .eq("vidu_task_id", body.id);

    return NextResponse.json({
      received: true,
      user_id: generation.user_id, // ✅ INCLUIR USER_ID EN RESPUESTA
    });
  } catch (error) {
    console.error(
      "💥 [Webhook] Critical error:",
      error instanceof Error ? error.message : String(error)
    );

    // Si body está definido, intentar marcar el webhook como procesado con error
    if (body?.id) {
      try {
        await supabase
          .from("vidu_webhook_logs")
          .update({
            processed: true,
            error_message: `Critical error: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            error_type: "CRITICAL_ERROR",
          })
          .eq("vidu_task_id", body.id);
      } catch (logError) {
        console.error(
          "💥 [Webhook] Cannot mark webhook as processed:",
          logError
        );
      }
    }

    return NextResponse.json({
      received: true,
      error: "Internal error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Vidu webhook is running",
  });
}
