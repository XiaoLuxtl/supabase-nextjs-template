// src/app/api/vidu/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("Vidu webhook received:", JSON.stringify(body, null, 2));

    // Guardar webhook log
    const { error: logError } = await supabase
      .from("vidu_webhook_logs")
      .insert({
        vidu_task_id: body.id,
        payload: body,
        processed: false,
      });

    if (logError) {
      console.error(
        "Error logging webhook:",
        JSON.stringify(logError, null, 2)
      );
    }

    // Verificar el estado de la generación
    if (body.state === "failed") {
      console.log("Processing 'failed' state for task:", body.id);
      const { data: generation, error: findError } = await supabase
        .from("video_generations")
        .select("*")
        .eq("vidu_task_id", body.id)
        .single();

      if (findError || !generation) {
        console.error("Generation not found for task:", body.id, findError);
        return NextResponse.json(
          { error: "Generation not found" },
          { status: 404 }
        );
      }

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
        console.error("Error updating generation to failed:", updateError);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }

      if (isNSFWError) {
        const { error: refundError } = await supabase.rpc(
          "refund_credit_for_video",
          {
            p_video_id: generation.id,
          }
        );
        if (refundError) {
          console.error("Error refunding credit:", refundError);
        }
      }

      await supabase
        .from("vidu_webhook_logs")
        .update({ processed: true })
        .eq("vidu_task_id", body.id);

      return NextResponse.json({ received: true, error: body.error });
    }

    // Handle "created" state
    if (body.state === "created") {
      console.log("Processing 'created' state for task:", body.id);
      const { data: generation, error: findError } = await supabase
        .from("video_generations")
        .select("*")
        .eq("vidu_task_id", body.id)
        .single();

      if (findError || !generation) {
        console.error("Generation not found for task:", body.id, findError);
        return NextResponse.json(
          { error: "Generation not found" },
          { status: 404 }
        );
      }

      if (generation.status !== "pending" && generation.status !== "queued") {
        const { error: updateError } = await supabase
          .from("video_generations")
          .update({
            status: "pending",
            vidu_full_response: body,
          })
          .eq("id", generation.id);

        if (updateError) {
          console.error("Error updating generation to pending:", updateError);
          return NextResponse.json({ error: "Update failed" }, { status: 500 });
        }
      }

      await supabase
        .from("vidu_webhook_logs")
        .update({ processed: true })
        .eq("vidu_task_id", body.id);

      console.log("Task marked as pending:", generation.id);
      return NextResponse.json({
        received: true,
        processed: true,
        generation_id: generation.id,
      });
    }

    // Handle "success" state
    if (body.state === "success") {
      console.log("Processing 'success' state for task:", body.id);
      const taskId = body.id;
      const creation = body.creations?.[0];

      if (!taskId || !creation) {
        console.error("Invalid webhook data: missing taskId or creations");
        return NextResponse.json({ error: "Invalid data" }, { status: 400 });
      }

      const { data: generation, error: findError } = await supabase
        .from("video_generations")
        .select("*")
        .eq("vidu_task_id", taskId)
        .single();

      if (findError || !generation) {
        console.error("Generation not found for task:", taskId, findError);
        return NextResponse.json(
          { error: "Generation not found" },
          { status: 404 }
        );
      }

      const { error: updateError } = await supabase
        .from("video_generations")
        .update({
          status: "completed",
          vidu_creation_id: creation.id,
          video_url: creation.url,
          cover_url: creation.thumbnail_url || creation.cover_url,
          video_duration_actual: creation.video?.duration || 0,
          video_fps: creation.video?.fps || 0,
          bgm: body.bgm || false,
          completed_at: new Date().toISOString(),
          vidu_full_response: body,
        })
        .eq("id", generation.id);

      if (updateError) {
        console.error("Error updating generation to completed:", updateError);
        return NextResponse.json({ error: "Update failed" }, { status: 500 });
      }

      await supabase
        .from("vidu_webhook_logs")
        .update({ processed: true })
        .eq("vidu_task_id", taskId);

      console.log("Video generation completed:", generation.id);
      return NextResponse.json({
        received: true,
        processed: true,
        generation_id: generation.id,
      });
    }

    // Handle other states (e.g., "queueing", "processing")
    console.log("Webhook state not handled:", body.state);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", JSON.stringify(error, null, 2));
    return NextResponse.json({
      received: true,
      error: "Internal error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok" });
}
