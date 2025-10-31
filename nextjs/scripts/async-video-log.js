// scripts/async-video-log.js
const { createClient } = require("@supabase/supabase-js");

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.PRIVATE_SUPABASE_SERVICE_KEY
) {
  console.error("⛔ Environment variables missing. Please set:");
  console.error("- NEXT_PUBLIC_SUPABASE_URL");
  console.error("- PRIVATE_SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY
);

async function logVideoProcessingState(videoId) {
  try {
    // 1. Get video generation record
    const { data: videos, error: videoError } = await supabase
      .from("video_generations")
      .select("*")
      .eq("id", videoId);

    if (videoError) {
      throw new Error(`Error fetching video: ${videoError.message}`);
    }

    if (!videos || videos.length === 0) {
      throw new Error(`Video not found with ID: ${videoId}`);
    }

    const video = videos[0];

    console.log("\n📽️ Video Generation Details:");
    console.log("-----------------------------");
    console.log(`ID: ${video.id}`);
    console.log(`Status: ${video.status}`);
    console.log(`Vidu Task ID: ${video.vidu_task_id || "Not assigned"}`);
    console.log(`Created: ${new Date(video.created_at).toLocaleString()}`);
    console.log(`Updated: ${new Date(video.updated_at).toLocaleString()}`);
    console.log(`User ID: ${video.user_id}`);
    console.log(`Error Message: ${video.error_message || "None"}`);
    console.log(`Retry Count: ${video.retry_count || 0}`);

    // 2. Get related webhook logs
    const { data: webhooks, error: webhookError } = await supabase
      .from("vidu_webhook_logs")
      .select("*")
      .eq("vidu_task_id", video.vidu_task_id)
      .order("received_at", { ascending: true });

    if (webhookError) {
      throw new Error(`Error fetching webhooks: ${webhookError.message}`);
    }

    if (webhooks && webhooks.length > 0) {
      console.log("\n📬 Webhook History:");
      console.log("------------------");
      webhooks.forEach((webhook, index) => {
        console.log(`\nWebhook #${index + 1}:`);
        console.log(
          `Received: ${new Date(webhook.received_at).toLocaleString()}`
        );
        console.log(`Processed: ${webhook.processed}`);
        console.log("Payload:", JSON.stringify(webhook.payload, null, 2));
      });
    } else {
      console.log("\n⚠️ No webhook logs found for this video.");
    }

    // 3. Get transaction record if exists
    const { data: transaction, error: txError } = await supabase
      .from("credit_transactions")
      .select("*")
      .eq("video_id", videoId)
      .maybeSingle();

    if (txError) {
      throw new Error(`Error fetching transaction: ${txError.message}`);
    }

    if (transaction) {
      console.log("\n💳 Credit Transaction:");
      console.log("--------------------");
      console.log(`ID: ${transaction.id}`);
      console.log(`Type: ${transaction.type}`);
      console.log(`Amount: ${transaction.amount}`);
      console.log(`Status: ${transaction.status}`);
      console.log(
        `Created: ${new Date(transaction.created_at).toLocaleString()}`
      );
    } else {
      console.log("\n⚠️ No credit transaction found for this video.");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Get video ID from command line arguments
const videoId = process.argv[2];

if (!videoId) {
  console.error("⛔ Please provide a video ID as an argument");
  console.log("Usage: node async-video-log.js <video_id>");
  process.exit(1);
}

// Execute the main function
logVideoProcessingState(videoId).then(() => {
  console.log("\n✅ Log analysis complete");
  process.exit(0);
});
