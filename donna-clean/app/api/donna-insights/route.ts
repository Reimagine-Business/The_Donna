import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import {
  buildDonnaInsightsPrompt,
  buildBusinessBioContext,
  cleanDonnaResponse,
} from "@/lib/donna-personality";
import { buildFinancialSummary } from "@/lib/financial-summary";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Auth check
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];

    // CHECK CACHE FIRST — return cached insights if from today
    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, cached_insights, insights_cache_date")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profile?.cached_insights && profile?.insights_cache_date === today) {
      try {
        const cachedBullets = JSON.parse(profile.cached_insights);
        if (Array.isArray(cachedBullets) && cachedBullets.length > 0) {
          // Still need reminder counts for additionalCount
          const { data: reminders } = await supabase
            .from("reminders")
            .select("due_date, status")
            .eq("user_id", user.id)
            .eq("status", "pending");

          const overdueCount = (reminders || []).filter(
            (r) => r.status === "pending" && r.due_date < today
          ).length;
          const oneWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
          const upcomingCount = (reminders || []).filter(
            (r) => r.status === "pending" && r.due_date >= today && r.due_date <= oneWeek
          ).length;

          return NextResponse.json({
            bullets: cachedBullets,
            additionalCount: Math.max(0, overdueCount + upcomingCount - 1),
            cached: true,
          });
        }
      } catch {
        // Invalid cached data — regenerate
      }
    }

    // Build compact financial summary (pre-calculated, not raw entries)
    const financialContext = await buildFinancialSummary(supabase, user.id);

    // Get business bio for personalization
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("business_context")
      .eq("user_id", user.id)
      .maybeSingle();

    const bioContext = buildBusinessBioContext(
      businessProfile?.business_context || {}
    );

    // Build compact prompt (~400 tokens vs ~3,500 before)
    const fullContext = `Business: ${profile?.business_name || "Small Business"}\n${bioContext}\n\n${financialContext}`;
    const fullPrompt = buildDonnaInsightsPrompt(fullContext);

    // Call Claude with reduced tokens
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 150,
      temperature: 0.7,
      messages: [{ role: "user", content: fullPrompt }],
    });

    // Log AI usage for cost tracking
    try {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const inputTokens = response.usage?.input_tokens || 0;
      const outputTokens = response.usage?.output_tokens || 0;
      await adminClient.from("ai_usage_logs").insert({
        user_id: user.id,
        feature: "insights",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        cost_usd:
          (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15,
        model: "claude-sonnet-4-5-20250929",
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error("[Donna Insights] Usage log error:", logErr);
    }

    // Parse the AI response and clean it
    const textBlock = response.content.find((b) => b.type === "text");
    let insights = textBlock ? textBlock.text.trim() : "";

    // Clean with safety net
    insights = cleanDonnaResponse(insights)
      .replace(/\*\*/g, "")
      .replace(/^#+\s*/gm, "")
      .trim();

    // Parse bullets from plain text (one per line, starting with - or •)
    let bullets = insights
      .split("\n")
      .map((line) => line.replace(/^[-•]\s*/, "").trim())
      .filter((line) => line.length > 10)
      .slice(0, 3);

    // If parsing as plain text didn't work, try JSON array
    if (bullets.length === 0) {
      try {
        const rawText = insights
          .replace(/^```(?:json)?\s*\n?/i, "")
          .replace(/\n?```\s*$/i, "")
          .trim();
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
          bullets = parsed
            .map((b) => String(b).trim())
            .filter(Boolean)
            .slice(0, 3);
        }
      } catch {
        // JSON parsing also failed
      }
    }

    // Fallback: calm default message
    if (bullets.length === 0) {
      bullets = [
        "Building note: You're tracking your business carefully — that's the foundation everything else is built on. 👉 Keep the entries consistent.",
        "Cash update: Check this week's cash position to stay on top of things. 👉 A quick review takes two minutes.",
        "Good news: Every entry you add makes Donna's advice more accurate. 👉 You're building something useful here.",
      ];
    }

    // SAVE TO CACHE — store as JSON array
    try {
      await supabase
        .from("profiles")
        .update({
          cached_insights: JSON.stringify(bullets),
          insights_cache_date: today,
          insights_cached_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } catch {
      // Cache save failure is non-critical
    }

    // Get reminder counts for additionalCount
    const { data: reminders } = await supabase
      .from("reminders")
      .select("due_date, status")
      .eq("user_id", user.id)
      .eq("status", "pending");

    const overdueCount = (reminders || []).filter(
      (r) => r.status === "pending" && r.due_date < today
    ).length;
    const oneWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const upcomingCount = (reminders || []).filter(
      (r) => r.status === "pending" && r.due_date >= today && r.due_date <= oneWeek
    ).length;

    return NextResponse.json({
      bullets,
      additionalCount: Math.max(0, overdueCount + upcomingCount - 1),
      cached: false,
    });
  } catch (error) {
    console.error("[Donna AI] Error:", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}

// Invalidate cache — called via DELETE /api/donna-insights
export async function DELETE() {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await supabase
      .from("profiles")
      .update({
        insights_cache_date: null,
        cached_insights: null,
      })
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to invalidate cache" }, { status: 500 });
  }
}
