import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import {
  buildDonnaChatPromptV2,
  buildBusinessBioContext,
  cleanDonnaResponse,
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

    // Get today's usage
    const { data: todayUsage } = await supabase
      .from("chat_usage")
      .select("daily_count")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    // Get monthly total (sum all days this month)
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

    // Check limits
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

    // Get business bio
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("business_context")
      .eq("user_id", user.id)
      .maybeSingle();

    const bioContext = buildBusinessBioContext(
      businessProfile?.business_context || {}
    );

    // Get compact financial context (pre-calculated summaries)
    const financialContext = await buildChatFinancialContext(
      supabase,
      user.id
    );

    // Build compact prompt (~800 tokens vs ~3,500 before)
    const fullPrompt = buildDonnaChatPromptV2(
      financialContext,
      message,
      bioContext
    );

    // ─────────────────────────────────────────────
    // CALL GEMINI
    // ─────────────────────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: fullPrompt,
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7,
      },
    });

    // Build Gemini contents from history + current message
    const recentHistory = history.slice(-20);
    const contents = [
      ...recentHistory.map((msg: ChatMessage) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    let reply = "";
    let geminiResult: Awaited<ReturnType<typeof model.generateContent>> | null = null;

    try {
      geminiResult = await model.generateContent({ contents });
      reply = geminiResult.response.text().trim();
    } catch (aiError) {
      console.error("[Donna Chat] Gemini API error:", aiError);
      Sentry.captureException(aiError, {
        tags: { endpoint: "donna-chat", userId: user.id },
      });
    }

    // Fallback if AI failed or returned empty
    if (!reply || reply.length < 5) {
      reply = !geminiResult
        ? "Hmm, I'm having a little trouble connecting right now. 😌 Give it a moment and try again — I'll be back shortly."
        : "I don't have enough data to answer that clearly yet. Try adding more entries and I'll give you a better picture!";
    }

    // Clean with shared safety net
    reply = cleanDonnaResponse(reply)
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .trim();

    // ─────────────────────────────────────────────
    // UPDATE USAGE + LOG (only if AI succeeded)
    // ─────────────────────────────────────────────
    if (geminiResult) {
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
    }

    // Log token usage for admin cost tracking
    if (geminiResult) {
      try {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        const inputTokens = geminiResult.response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = geminiResult.response.usageMetadata?.candidatesTokenCount || 0;
        await adminClient.from("ai_usage_logs").insert({
          user_id: user.id,
          feature: "chat",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          total_tokens: inputTokens + outputTokens,
          cost_usd:
            (inputTokens / 1_000_000) * 0.10 +
            (outputTokens / 1_000_000) * 0.40,
          model: "gemini-2.0-flash",
          created_at: new Date().toISOString(),
        });
      } catch (logErr) {
        console.error("[Donna Chat] Usage log error:", logErr);
      }
    }

    const newDailyCount = geminiResult ? dailyCount + 1 : dailyCount;
    const newMonthlyCount = geminiResult ? monthlyCount + 1 : monthlyCount;

    return NextResponse.json({
      reply,
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
