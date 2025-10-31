// scripts/fix-pending-webhooks.js
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

// Cargar específicamente .env.local
require("dotenv").config({ path: path.resolve(process.cwd(), ".env.local") });

// También intentar cargar .env como fallback
require("dotenv").config();

console.log("🔍 Verificando variables de entorno...");
console.log(
  "NEXT_PUBLIC_SUPABASE_URL:",
  process.env.NEXT_PUBLIC_SUPABASE_URL ? "✅ Presente" : "❌ Faltante"
);
console.log(
  "PRIVATE_SUPABASE_SERVICE_KEY:",
  process.env.PRIVATE_SUPABASE_SERVICE_KEY ? "✅ Presente" : "❌ Faltante"
);

// Validar variables de entorno
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.PRIVATE_SUPABASE_SERVICE_KEY
) {
  console.error("❌ Error: Variables de entorno faltantes");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function fixPendingWebhooks() {
  console.log("🔄 Iniciando reparación de webhooks pendientes...");

  try {
    // 1. Obtener todos los webhooks no procesados
    const { data: pendingWebhooks, error } = await supabase
      .from("vidu_webhook_logs")
      .select("*")
      .eq("processed", false)
      .order("received_at", { ascending: true });

    if (error) {
      console.error("❌ Error obteniendo webhooks pendientes:", error);
      return;
    }

    console.log(
      `📊 Encontrados ${pendingWebhooks?.length || 0} webhooks pendientes`
    );

    if (!pendingWebhooks || pendingWebhooks.length === 0) {
      console.log("✅ No hay webhooks pendientes por procesar");
      return;
    }

    // 2. Agrupar por task_id para procesar solo el más reciente de cada task
    const tasksMap = new Map();

    pendingWebhooks.forEach((webhook) => {
      const taskId = webhook.vidu_task_id;
      if (!tasksMap.has(taskId)) {
        tasksMap.set(taskId, []);
      }
      tasksMap.get(taskId).push(webhook);
    });

    console.log(`🔍 Agrupados en ${tasksMap.size} taskIds únicos`);

    let processedCount = 0;
    let errorCount = 0;

    // 3. Procesar cada taskId
    for (const [taskId, webhooks] of tasksMap.entries()) {
      try {
        console.log(`\n🔄 Procesando taskId: ${taskId}`);
        console.log(`   📨 Webhooks encontrados: ${webhooks.length}`);

        // Ordenar por fecha (más reciente primero)
        webhooks.sort(
          (a, b) =>
            new Date(b.received_at).getTime() -
            new Date(a.received_at).getTime()
        );

        const latestWebhook = webhooks[0];
        console.log(`   🎯 Webhook más reciente:`, {
          id: latestWebhook.id,
          state: latestWebhook.payload?.state,
          received_at: latestWebhook.received_at,
        });

        // 4. Buscar la generación correspondiente
        const { data: generation, error: genError } = await supabase
          .from("video_generations")
          .select("*")
          .eq("vidu_task_id", taskId)
          .single();

        if (genError || !generation) {
          console.log(`   ❌ No se encontró generación para taskId: ${taskId}`);

          // Marcar todos los webhooks de este task como procesados con error
          await markWebhooksAsProcessed(
            webhooks.map((w) => w.id),
            "GENERATION_NOT_FOUND",
            "No se encontró la generación correspondiente"
          );

          errorCount++;
          continue;
        }

        console.log(`   ✅ Generación encontrada:`, {
          id: generation.id,
          status: generation.status,
          user_id: generation.user_id,
        });

        // 5. Verificar si ya está procesada en video_generations
        if (
          generation.status === "completed" ||
          generation.status === "failed"
        ) {
          console.log(
            `   ℹ️  Generación ya está en estado final: ${generation.status}`
          );

          await markWebhooksAsProcessed(
            webhooks.map((w) => w.id),
            "ALREADY_PROCESSED",
            `Generación ya en estado: ${generation.status}`
          );

          processedCount++;
          continue;
        }

        // 6. Procesar el webhook más reciente según su estado
        const webhookState = latestWebhook.payload?.state;

        switch (webhookState) {
          case "success":
            await processSuccessWebhook(latestWebhook, generation);
            break;
          case "failed":
            await processFailedWebhook(latestWebhook, generation);
            break;
          case "processing":
          case "created":
            // Para estos estados, solo marcamos como procesados
            console.log(
              `   ℹ️  Estado intermedio: ${webhookState}, marcando como procesado`
            );
            await markWebhooksAsProcessed(
              webhooks.map((w) => w.id),
              "INTERMEDIATE_STATE_PROCESSED",
              `Estado intermedio: ${webhookState}`
            );
            break;
          default:
            console.log(`   ⚠️  Estado no manejado: ${webhookState}`);
            await markWebhooksAsProcessed(
              webhooks.map((w) => w.id),
              "UNHANDLED_STATE",
              `Estado no manejado: ${webhookState}`
            );
        }

        processedCount++;
      } catch (taskError) {
        console.error(`💥 Error procesando taskId ${taskId}:`, taskError);
        errorCount++;
      }
    }

    console.log(`\n🎉 Reparación completada:`);
    console.log(`   ✅ Procesados: ${processedCount}`);
    console.log(`   ❌ Errores: ${errorCount}`);
    console.log(`   📊 Total: ${processedCount + errorCount}`);
  } catch (error) {
    console.error("💥 Error crítico en el script:", error);
  }
}

async function processSuccessWebhook(webhook, generation) {
  const creation = webhook.payload?.creations?.[0];

  if (!creation) {
    console.log(`   ❌ Webhook success sin creación`);
    await markWebhooksAsProcessed(
      [webhook.id],
      "INVALID_SUCCESS",
      "Success sin creación"
    );
    return;
  }

  console.log(`   ✅ Procesando success con video URL:`, creation.url);

  // Actualizar la generación
  const { error: updateError } = await supabase
    .from("video_generations")
    .update({
      status: "completed",
      vidu_creation_id: creation.id,
      video_url: creation.url,
      cover_url: creation.cover_url,
      video_duration_actual: creation.video?.duration || 0,
      video_fps: creation.video?.fps || 0,
      bgm: webhook.payload.bgm || false,
      completed_at: new Date().toISOString(),
      vidu_full_response: webhook.payload,
    })
    .eq("id", generation.id);

  if (updateError) {
    console.error(`   ❌ Error actualizando generación:`, updateError);
    await markWebhooksAsProcessed(
      [webhook.id],
      "UPDATE_ERROR",
      `Error: ${updateError.message}`
    );
    return;
  }

  // Actualizar contador del usuario usando la función RPC
  await updateUserVideoCount(generation.user_id);

  // Marcar webhook como procesado
  await markWebhooksAsProcessed(
    [webhook.id],
    "SUCCESS_PROCESSED",
    "Procesado exitosamente"
  );

  console.log(`   🎉 Generación ${generation.id} marcada como completada`);
}

async function processFailedWebhook(webhook, generation) {
  const errorMessage = webhook.payload?.error;
  const isNSFW =
    errorMessage?.toLowerCase().includes("nsfw") ||
    webhook.payload?.err_code === "AuditSubmitIllegal";

  console.log(`   ❌ Procesando failed:`, {
    error: errorMessage,
    isNSFW,
    err_code: webhook.payload?.err_code,
  });

  const { error: updateError } = await supabase
    .from("video_generations")
    .update({
      status: "failed",
      error_code: isNSFW ? "NSFW_CONTENT" : "VIDU_ERROR",
      error_message: isNSFW
        ? "Contenido no permitido detectado por Vidu"
        : errorMessage || "Error en la generación del video",
      completed_at: new Date().toISOString(),
      vidu_full_response: webhook.payload,
    })
    .eq("id", generation.id);

  if (updateError) {
    console.error(`   ❌ Error marcando como failed:`, updateError);
  }

  // Marcar webhook como procesado
  await markWebhooksAsProcessed(
    [webhook.id],
    "FAILED_PROCESSED",
    `Failed procesado: ${isNSFW ? "NSFW" : "Error general"}`
  );

  console.log(`   📝 Generación ${generation.id} marcada como fallida`);
}

async function markWebhooksAsProcessed(webhookIds, errorType, message) {
  const { error } = await supabase
    .from("vidu_webhook_logs")
    .update({
      processed: true,
      error_type: errorType,
      error_message: message,
    })
    .in("id", webhookIds);

  if (error) {
    console.error(`   ❌ Error marcando webhooks como procesados:`, error);
  } else {
    console.log(
      `   ✅ ${webhookIds.length} webhooks marcados como procesados: ${message}`
    );
  }
}

async function updateUserVideoCount(userId) {
  try {
    const { error } = await supabase.rpc("increment_user_video_count", {
      user_id: userId,
    });

    if (error) {
      console.error(`   ❌ Error incrementando contador:`, error);
      return false;
    }

    console.log(`   ✅ Contador incrementado para usuario: ${userId}`);
    return true;
  } catch (error) {
    console.error(`   ❌ Error en updateUserVideoCount:`, error);
    return false;
  }
}

// Ejecutar el script
fixPendingWebhooks().catch(console.error);
