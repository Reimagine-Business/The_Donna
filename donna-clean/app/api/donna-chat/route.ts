import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import {
  DONNA_CHAT_COMPACT,
  buildBusinessBioContext,
  buildFeedbackContext,
  cleanDonnaResponse,
  type FeedbackRow,
} from "@/lib/donna-personality";
import { buildChatFinancialContext } from "@/lib/financial-summary";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

const DAILY_LIMIT = 10;
const MONTHLY_LIMIT = 100;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { message, history = [] } = body as {
      message: string;
      history: ChatMessage[];
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // RATE LIMIT CHECK
    // ─────────────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const monthYear = today.substring(0, 7);

    const { data: todayUsage } = await supabase
      .from("chat_usage")
      .select("daily_count")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const { data: monthUsage } = await supabase
      .from("chat_usage")
      .select("daily_count")
      .eq("user_id", user.id)
      .like("date", `${monthYear}%`);

    const dailyCount = todayUsage?.daily_count || 0;
    const monthlyCount =
      monthUsage?.reduce(
        (sum: number, row: { daily_count: number }) =>
          sum + (row.daily_count || 0),
        0
      ) || 0;

    // Rate limit — return JSON (not SSE)
    if (dailyCount >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          reply: `You've used all ${DAILY_LIMIT} chats for today. Come back tomorrow — I'll be right here!`,
          usage: {
            dailyCount,
            monthlyCount,
            dailyLimit: DAILY_LIMIT,
            monthlyLimit: MONTHLY_LIMIT,
            dailyRemaining: 0,
            monthlyRemaining: Math.max(0, MONTHLY_LIMIT - monthlyCount),
          },
        },
        { status: 429 }
      );
    }

    if (monthlyCount >= MONTHLY_LIMIT) {
      return NextResponse.json(
        {
          reply: `You've used all ${MONTHLY_LIMIT} chats this month. Limit resets on the 1st. Your entries and data are all safe!`,
          usage: {
            dailyCount,
            monthlyCount,
            dailyLimit: DAILY_LIMIT,
            monthlyLimit: MONTHLY_LIMIT,
            dailyRemaining: 0,
            monthlyRemaining: 0,
          },
        },
        { status: 429 }
      );
    }

    // ─────────────────────────────────────────────
    // BUILD CONTEXT
    // ─────────────────────────────────────────────

    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("id, business_context")
      .eq("user_id", user.id)
      .maybeSingle();

    const bioContext = buildBusinessBioContext(
      businessProfile?.business_context || {}
    );

    const financialContext = await buildChatFinancialContext(supabase, user.id);

    // Fetch last 30 days of customer feedback
    let feedbackContext = "No customer feedback collected yet.";
    if (businessProfile?.id) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: feedbackRows } = await supabase
        .from("feedback_responses")
        .select("rating, liked_categories, improve_categories, comment")
        .eq("business_id", businessProfile.id)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });
      feedbackContext = buildFeedbackContext((feedbackRows || []) as FeedbackRow[]);
    }

    // Build user content: date + bio + financial data + feedback + question
    // DONNA_CHAT_COMPACT (personality + GOOD/BAD examples) is systemInstruction
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const userContent = [
      `CURRENT DATE: ${dateStr}`,
      bioContext ? `\nABOUT THIS BUSINESS:\n${bioContext}` : "",
      `\nFINANCIAL DATA:\n${financialContext}`,
      `\n${feedbackContext}`,
      `\nUSER ASKS: "${message}"`,
      `\nRespond as Donna (max 120 words, use "we/us/let's", face emojis only):`,
      `Address the owner by name if known from bio context. Never use "there" as a substitute for a name — use "we" if name is unknown.`,
    ]
      .filter(Boolean)
      .join("");

    // ─────────────────────────────────────────────
    // CALL GEMINI — STREAMING
    // ─────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // DONNA_CHAT_COMPACT goes to systemInstruction — pure personality, GOOD/BAD
    // examples, voice rules, structural guidance
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      systemInstruction: DONNA_CHAT_COMPACT,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    // History: previous turns as-is; current turn has full financial context
    const recentHistory = history.slice(-20);
    const contents = [
      ...recentHistory.map((msg: ChatMessage) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      { role: "user", parts: [{ text: userContent }] },
    ];

    // ─────────────────────────────────────────────
    // CALL GEMINI — NON-STREAMING
    // ─────────────────────────────────────────────
    const result = await model.generateContent({ contents });
    const response = result.response;
    const inputTokens = response.usageMetadata?.promptTokenCount || 0;
    const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;

    let rawReply = response.text();
    if (!rawReply || rawReply.length < 5) {
      rawReply =
        "I don't have enough data to answer that clearly yet. Try adding more entries and I'll give you a better picture!";
    }
    const cleanedReply = cleanDonnaResponse(rawReply)
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .trim();

    // Update usage in DB
    try {
      if (todayUsage) {
        await supabase
          .from("chat_usage")
          .update({
            daily_count: dailyCount + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("date", today);
      } else {
        await supabase.from("chat_usage").insert({
          user_id: user.id,
          date: today,
          month_year: monthYear,
          daily_count: 1,
        });
      }
    } catch (dbErr) {
      console.error("[Donna Chat] Usage update error:", dbErr);
    }

    // Log tokens for admin cost tracking
    try {
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      await adminClient.from("ai_usage_logs").insert({
        user_id: user.id,
        feature: "chat",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        cost_usd:
          (inputTokens / 1_000_000) * 0.1 +
          (outputTokens / 1_000_000) * 0.4,
        model: "gemini-2.5-flash-lite",
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error("[Donna Chat] Usage log error:", logErr);
    }

    const newDailyCount = dailyCount + 1;
    const newMonthlyCount = monthlyCount + 1;

    return NextResponse.json({
      reply: cleanedReply,
      usage: {
        dailyCount: newDailyCount,
        monthlyCount: newMonthlyCount,
        dailyLimit: DAILY_LIMIT,
        monthlyLimit: MONTHLY_LIMIT,
        dailyRemaining: DAILY_LIMIT - newDailyCount,
        monthlyRemaining: MONTHLY_LIMIT - newMonthlyCount,
      },
    });
  } catch (error) {
    console.error("[Donna Chat] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}

// GET endpoint to check usage
export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];
    const monthYear = today.substring(0, 7);

    const { data: todayUsage } = await supabase
      .from("chat_usage")
      .select("daily_count")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    const { data: monthUsage } = await supabase
      .from("chat_usage")
      .select("daily_count")
      .eq("user_id", user.id)
      .like("date", `${monthYear}%`);

    const dailyCount = todayUsage?.daily_count || 0;
    const monthlyCount =
      monthUsage?.reduce(
        (sum: number, row: { daily_count: number }) =>
          sum + (row.daily_count || 0),
        0
      ) || 0;

    return NextResponse.json({
      dailyCount,
      monthlyCount,
      dailyLimit: DAILY_LIMIT,
      monthlyLimit: MONTHLY_LIMIT,
      dailyRemaining: Math.max(0, DAILY_LIMIT - dailyCount),
      monthlyRemaining: Math.max(0, MONTHLY_LIMIT - monthlyCount),
    });
  } catch (error) {
    console.error("[Donna Chat] Usage check error:", error);
    return NextResponse.json(
      { error: "Failed to check usage" },
      { status: 500 }
    );
  }
}
