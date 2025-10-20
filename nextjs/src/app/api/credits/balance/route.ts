import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.PRIVATE_SUPABASE_SERVICE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("credits_balance")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error getting credits balance:", error);
      return NextResponse.json(
        { error: "Failed to get balance" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      balance: data?.credits_balance ?? 0,
    });
  } catch (error) {
    console.error("Error in credits balance API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
