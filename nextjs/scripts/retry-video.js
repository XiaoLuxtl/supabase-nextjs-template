// scripts/retry-video.js
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

async function retryVideo(videoId) {
  try {
    console.log("🔄 Attempting to retry video generation...");

    // 1. Reset video status to pending
    const { error: updateError } = await supabase
      .from("video_generations")
      .update({
        status: "pending",
        error_message: null,
        error_code: null,
        vidu_task_id: null,
        retry_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", videoId);

    if (updateError) {
      throw new Error(`Failed to update video status: ${updateError.message}`);
    }

    console.log("✅ Video status reset successfully");
    console.log("✨ The video is now ready for reprocessing");
    console.log("\nℹ️ Next steps:");
    console.log("1. The video will be picked up automatically by the system");
    console.log("2. A new task_id will be assigned when successful");
    console.log(
      "3. You can monitor progress using: node scripts/async-video-log.js",
      videoId
    );
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Get video ID from command line arguments
const videoId = process.argv[2];

if (!videoId) {
  console.error("⛔ Please provide a video ID as an argument");
  console.log("Usage: node retry-video.js <video_id>");
  process.exit(1);
}

// Execute the retry
retryVideo(videoId).then(() => {
  console.log("\n✅ Retry process complete");
  process.exit(0);
});
