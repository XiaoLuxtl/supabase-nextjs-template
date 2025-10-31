// scripts/find-lost-relations.js
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({
  path: require("path").resolve(process.cwd(), ".env.local"),
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function findLostRelations() {
  console.log(
    "🔍 Buscando relaciones perdidas entre generaciones y usuarios..."
  );

  try {
    // 1. Obtener todas las generaciones pendientes sin task_id
    const { data: pendingGenerations, error: genError } = await supabase
      .from("video_generations")
      .select("*")
      .eq("status", "pending")
      .is("vidu_task_id", null);

    if (genError) throw genError;

    console.log(
      `📊 Encontradas ${pendingGenerations.length} generaciones pendientes sin task_id`
    );

    // 2. Buscar transacciones de créditos para estas generaciones
    const generationIds = pendingGenerations.map((gen) => gen.id);

    const { data: transactions, error: transError } = await supabase
      .from("credit_transactions")
      .select("*, user_profiles(email, full_name)")
      .in("video_id", generationIds)
      .eq("transaction_type", "consumption");

    if (transError) throw transError;

    console.log(
      `💰 Encontradas ${transactions.length} transacciones relacionadas`
    );

    // 3. Mostrar relaciones encontradas
    console.log("\n🔗 RELACIONES ENCONTRADAS:");
    transactions.forEach((trans) => {
      const generation = pendingGenerations.find(
        (gen) => gen.id === trans.video_id
      );
      console.log(`   📹 Generación: ${trans.video_id}`);
      console.log(
        `   👤 Usuario: ${trans.user_id} (${trans.user_profiles?.email})`
      );
      console.log(`   📝 Prompt: ${generation?.prompt?.substring(0, 50)}...`);
      console.log(`   🕐 Creado: ${generation?.created_at}`);
      console.log(`   ---`);
    });

    // 4. Si hay discrepancias, mostrarlas
    const generationsWithUser = transactions.map((trans) => trans.video_id);
    const generationsWithoutUser = pendingGenerations.filter(
      (gen) => !generationsWithUser.includes(gen.id)
    );

    if (generationsWithoutUser.length > 0) {
      console.log("\n❌ GENERACIONES SIN USUARIO ENCONTRADO:");
      generationsWithoutUser.forEach((gen) => {
        console.log(`   📹 ID: ${gen.id}`);
        console.log(`   📝 Prompt: ${gen.prompt?.substring(0, 50)}...`);
        console.log(`   🕐 Creado: ${gen.created_at}`);
      });
    }

    // 5. Preguntar si queremos reparar
    if (transactions.length > 0) {
      console.log(
        `\n💡 ¿Quieres reparar estas ${transactions.length} relaciones? (s/n)`
      );
      // En un script real, aquí leerías la respuesta del usuario
      // Por ahora, asumimos que sí
      await repairRelations(transactions, pendingGenerations);
    }
  } catch (error) {
    console.error("💥 Error:", error);
  }
}

async function repairRelations(transactions, pendingGenerations) {
  console.log("\n🔧 Reparando relaciones...");

  let repairedCount = 0;
  let errorCount = 0;

  for (const trans of transactions) {
    try {
      const generation = pendingGenerations.find(
        (gen) => gen.id === trans.video_id
      );

      if (!generation) {
        console.log(
          `   ❌ No se encontró generación para transacción: ${trans.video_id}`
        );
        continue;
      }

      // Verificar si ya tiene el user_id correcto
      if (generation.user_id === trans.user_id) {
        console.log(
          `   ✅ Generación ${generation.id} ya tiene usuario correcto: ${trans.user_id}`
        );
        continue;
      }

      console.log(`   🔄 Reparando generación ${generation.id}:`);
      console.log(`      Usuario actual: ${generation.user_id}`);
      console.log(
        `      Usuario correcto: ${trans.user_id} (${trans.user_profiles?.email})`
      );

      // Actualizar la generación con el user_id correcto
      const { error: updateError } = await supabase
        .from("video_generations")
        .update({
          user_id: trans.user_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", generation.id);

      if (updateError) {
        console.error(
          `   ❌ Error actualizando generación ${generation.id}:`,
          updateError
        );
        errorCount++;
      } else {
        console.log(`   ✅ Generación ${generation.id} reparada correctamente`);
        repairedCount++;
      }
    } catch (error) {
      console.error(`   💥 Error procesando transacción:`, error);
      errorCount++;
    }
  }

  console.log(`\n🎉 Reparación completada:`);
  console.log(`   ✅ Reparadas: ${repairedCount}`);
  console.log(`   ❌ Errores: ${errorCount}`);
}

// Ejecutar
findLostRelations().catch(console.error);
