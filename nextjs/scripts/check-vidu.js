// scripts/check-vidu.js
require("dotenv").config({ path: ".env.local" });

if (!process.env.VIDU_API_URL || !process.env.VIDU_API_KEY) {
  console.error("⛔ Vidu environment variables missing. Please check:");
  console.error(
    "- VIDU_API_URL:",
    process.env.VIDU_API_URL ? "✅ Set" : "❌ Missing"
  );
  console.error(
    "- VIDU_API_KEY:",
    process.env.VIDU_API_KEY ? "✅ Set" : "❌ Missing"
  );
  process.exit(1);
}

async function checkViduStatus() {
  try {
    console.log("🔍 Checking Vidu API status...");

    // Minimal test payload
    const testPayload = {
      model: "viduq1",
      images: [],
      prompt: "test connection",
      duration: 5,
      resolution: "1080p",
      callback_url: "https://example.com/callback",
    };

    const response = await fetch("https://api.vidu.com/ent/v2/img2video", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.VIDU_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testPayload),
    });

    console.log("\n📡 API Response:");
    console.log("Status:", response.status, response.statusText);
    console.log("Headers:", Object.fromEntries(response.headers));

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      console.log("Body:", JSON.stringify(json, null, 2));
    } catch {
      console.log("Body:", text);
    }

    if (response.ok) {
      console.log("\n✅ Vidu API is accessible and responding");
    } else if (response.status === 403) {
      console.log(
        "\n❌ Authentication failed - API key may be invalid or expired"
      );
    } else {
      console.log("\n⚠️ API responded with an unexpected status");
    }
  } catch (error) {
    console.error("\n💥 Error checking Vidu API:", error.message);
    process.exit(1);
  }
}

checkViduStatus().then(() => process.exit(0));
