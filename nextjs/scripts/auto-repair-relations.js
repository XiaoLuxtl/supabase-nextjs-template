// scripts/auto-repair-relations.js
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({
  path: require("path").resolve(process.cwd(), ".env.local"),
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function autoRepairRelations() {
  console.log("🔧 Reparación automática de relaciones...");

  try {
    // Buscar discrepancias entre video_generations y credit_transactions
    const { data: discrepancies, error } = await supabase
      .from("credit_transactions")
      .select(
        `
        video_id,
        user_id,
        user_profiles!inner(email, full_name),
        video_generations!inner(id, user_id as gen_user_id, status, prompt)
      `
      )
      .eq("transaction_type", "consumption")
      .neq("video_generations.user_id", "credit_transactions.user_id");

    if (error) throw error;

    console.log(`📊 Encontradas ${discrepancies.length} discrepancias`);

    for (const disc of discrepancies) {
      console.log(`\n🔄 Reparando: ${disc.video_id}`);
      console.log(
        `   👤 Usuario en transacción: ${disc.user_id} (${disc.user_profiles.email})`
      );
      console.log(
        `   👤 Usuario en generación: ${disc.video_generations.gen_user_id}`
      );
      console.log(
        `   📝 Prompt: ${disc.video_generations.prompt.substring(0, 50)}...`
      );

      const { error: updateError } = await supabase
        .from("video_generations")
        .update({
          user_id: disc.user_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", disc.video_id);

      if (updateError) {
        console.error(`   ❌ Error:`, updateError);
      } else {
        console.log(`   ✅ Reparada correctamente`);
      }
    }

    console.log(`\n🎉 Reparación automática completada`);
  } catch (error) {
    console.error("💥 Error:", error);
  }
}

autoRepairRelations().catch(console.error);
