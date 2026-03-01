import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import {
  buildDonnaInsightsPrompt,
  buildBusinessBioContext,
  cleanDonnaResponse,
} from "@/lib/donna-personality";
import { buildFinancialSummary } from "@/lib/financial-summary";
import * as Sentry from "@sentry/nextjs";

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

    console.log("[Donna Insights] Financial context for AI prompt:", financialContext);

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

    // Call ChatGPT
    const apiKey = process.env.CHATGPT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    let response: OpenAI.ChatCompletion;

    try {
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 150,
        temperature: 0.7,
        messages: [{ role: "user", content: fullPrompt }],
      });
    } catch (aiError) {
      console.error("[Donna Insights] OpenAI API error:", aiError);
      Sentry.captureException(aiError, {
        tags: { endpoint: "donna-insights", userId: user.id },
      });

      // Fall back to cached insights from profile
      if (profile?.cached_insights) {
        try {
          const cachedBullets = JSON.parse(profile.cached_insights);
          if (Array.isArray(cachedBullets) && cachedBullets.length > 0) {
            return NextResponse.json({
              bullets: cachedBullets,
              additionalCount: 0,
              cached: true,
            });
          }
        } catch {
          // Invalid cached data — use fallback below
        }
      }

      // No cache available — return friendly fallback (never 500)
      return NextResponse.json({
        bullets: [
          "I'm taking a short break right now. Your recent entries are recorded safely — I'll have fresh insights for you soon.",
        ],
        additionalCount: 0,
        cached: true,
      });
    }

    // Log AI usage for cost tracking
    try {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const inputTokens = response.usage?.prompt_tokens || 0;
      const outputTokens = response.usage?.completion_tokens || 0;
      await adminClient.from("ai_usage_logs").insert({
        user_id: user.id,
        feature: "insights",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        cost_usd:
          (inputTokens / 1_000_000) * 2.5 + (outputTokens / 1_000_000) * 10,
        model: "gpt-4o",
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error("[Donna Insights] Usage log error:", logErr);
    }

    // Parse the AI response and clean it
    let insights = response.choices[0]?.message?.content?.trim() || "";

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
    } catch (cacheErr) {
      console.warn("[Donna Insights] Cache save failed:", cacheErr);
      Sentry.captureException(cacheErr, {
        tags: { endpoint: "donna-insights", action: "cache-save" },
      });
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
    Sentry.captureException(error, {
      tags: { endpoint: "donna-insights" },
    });
    return NextResponse.json({
      bullets: [
        "I'm taking a short break right now. Your recent entries are recorded safely — I'll have fresh insights for you soon.",
      ],
      additionalCount: 0,
      cached: true,
    });
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
