import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import {
  DONNA_INSIGHTS_COMPACT,
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
          const { data: reminders } = await supabase
            .from("reminders")
            .select("due_date, status")
            .eq("user_id", user.id)
            .eq("status", "pending");

          const overdueCount = (reminders || []).filter(
            (r) => r.status === "pending" && r.due_date < today
          ).length;
          const oneWeek = new Date(Date.now() + 7 * 86400000)
            .toISOString()
            .split("T")[0];
          const upcomingCount = (reminders || []).filter(
            (r) =>
              r.status === "pending" &&
              r.due_date >= today &&
              r.due_date <= oneWeek
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

    // Build compact financial summary
    const financialContext = await buildFinancialSummary(supabase, user.id);

    console.log(
      "[Donna Insights] Financial context for AI prompt:",
      financialContext
    );

    // Get business bio for personalization
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("business_context")
      .eq("user_id", user.id)
      .maybeSingle();

    const bioContext = buildBusinessBioContext(
      businessProfile?.business_context || {}
    );

    // Build user content: date + business data
    // DONNA_INSIGHTS_COMPACT (personality + GOOD/BAD examples) is systemInstruction
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const hour = now.getHours();
    const timeOfDay =
      hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

    const fullContext = `Business: ${profile?.business_name || "Small Business"}\n${bioContext}\n\n${financialContext}`;

    const userContent = [
      `TODAY: ${dateStr}, ${timeOfDay}`,
      `\nBUSINESS DATA:\n${fullContext}`,
      `\nIf the business context includes a business name or owner name — use it naturally in one bullet. Never say "there" as a name. If no name is known, use "we" instead.`,
      `\nReturn your response as JSON matching exactly this structure:`,
      `{"insights":[{"bullet":"insight text here"},{"bullet":"insight text here"},{"bullet":"insight text here"}]}`,
      `\nGenerate 3 bullets now. Numbers first. Warm. Sharp. No decoration.`,
    ].join("");

    // Call Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // DONNA_INSIGHTS_COMPACT is systemInstruction — includes GOOD/BAD examples,
    // voice rules, bullet structure, cultural context
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: DONNA_INSIGHTS_COMPACT,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1000,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            insights: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.STRING,
                description:
                  "Warm, data-backed bullet point about the business.",
              },
              minItems: 3,
              maxItems: 3,
            },
            closing_question: {
              type: SchemaType.STRING,
              description: "A single, gentle, forward-looking question.",
            },
          },
          required: ["insights", "closing_question"],
        },
      },
    });

    let response: Awaited<ReturnType<typeof model.generateContent>>;

    try {
      response = await model.generateContent(userContent);
    } catch (aiError) {
      console.error("[Donna Insights] Gemini API error:", aiError);
      Sentry.captureException(aiError, {
        tags: { endpoint: "donna-insights", userId: user.id },
      });

      // Fall back to cached insights
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
      const inputTokens =
        response.response.usageMetadata?.promptTokenCount || 0;
      const outputTokens =
        response.response.usageMetadata?.candidatesTokenCount || 0;
      await adminClient.from("ai_usage_logs").insert({
        user_id: user.id,
        feature: "insights",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        cost_usd:
          (inputTokens / 1_000_000) * 0.1 + (outputTokens / 1_000_000) * 0.4,
        model: "gemini-2.0-flash",
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error("[Donna Insights] Usage log error:", logErr);
    }

    // Parse the structured JSON response
    let bullets: string[] = [];
    try {
      const rawText = response.response.text().trim();
      const parsed = JSON.parse(rawText);
      if (parsed.insights && Array.isArray(parsed.insights)) {
        bullets = (parsed.insights as string[])
          .map((item) => cleanDonnaResponse(String(item || "").trim()))
          .filter((b) => b.length > 5)
          .slice(0, 3);
      }
      if (parsed.closing_question && typeof parsed.closing_question === "string") {
        const cleanedQ = cleanDonnaResponse(parsed.closing_question.trim());
        if (cleanedQ.length > 5) {
          bullets.push(cleanedQ);
        }
      }
    } catch {
      // JSON parse failed — should not happen with responseMimeType: "application/json"
      // but handle gracefully
    }

    // Fallback: calm default message
    if (bullets.length === 0) {
      bullets = [
        "Building note: You're tracking your business carefully — that's the foundation everything else is built on. 👉 Keep the entries consistent.",
        "Cash update: Check this week's cash position to stay on top of things. 👉 A quick review takes two minutes.",
        "Good news: Every entry you add makes Donna's advice more accurate. 👉 You're building something useful here.",
      ];
    }

    // SAVE TO CACHE
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
    const oneWeek = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];
    const upcomingCount = (reminders || []).filter(
      (r) =>
        r.status === "pending" &&
        r.due_date >= today &&
        r.due_date <= oneWeek
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
    return NextResponse.json(
      { error: "Failed to invalidate cache" },
      { status: 500 }
    );
  }
}
