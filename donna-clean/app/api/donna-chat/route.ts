import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import { getEntries } from "@/app/entries/actions";
import {
  calculateCashBalance,
  getMonthlyComparison,
  getTotalCashIn,
  getTotalCashOut,
} from "@/lib/analytics-new";
import {
  getProfitMetrics,
  getRecommendations,
} from "@/lib/profit-calculations-new";
import { buildDonnaChatPrompt, buildBusinessBioContext } from "@/lib/donna-personality";

export const dynamic = "force-dynamic";

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

    // Fetch all business data
    const { entries } = await getEntries();

    const { data: reminders } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("due_date", { ascending: true });

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, username")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: parties } = await supabase
      .from("parties")
      .select("id, name, party_type, opening_balance")
      .eq("user_id", user.id)
      .order("name");

    // Fetch business profile for personalized context
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("business_context")
      .eq("user_id", user.id)
      .maybeSingle();
    const bCtx = businessProfile?.business_context || {};

    // Compute metrics
    const cashBalance = calculateCashBalance(entries);
    const totalCashIn = getTotalCashIn(entries);
    const totalCashOut = getTotalCashOut(entries);
    const monthly = getMonthlyComparison(entries);
    const profitMetrics = getProfitMetrics(entries);
    const recommendations = getRecommendations(entries);

    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .split("T")[0];

    const overdueReminders = (reminders || []).filter(
      (r: { status: string; due_date: string }) =>
        r.status === "pending" && r.due_date < today
    );
    const upcomingReminders = (reminders || []).filter(
      (r: { status: string; due_date: string }) => {
        const oneWeek = new Date(Date.now() + 7 * 86400000)
          .toISOString()
          .split("T")[0];
        return r.status === "pending" && r.due_date >= today && r.due_date <= oneWeek;
      }
    );

    // Pending collections and bills
    const pendingCollections = entries
      .filter(
        (e) =>
          e.entry_type === "Credit" && e.category === "Sales" && !e.settled
      )
      .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0);
    const pendingBills = entries
      .filter(
        (e) =>
          e.entry_type === "Credit" &&
          ["COGS", "Opex"].includes(e.category) &&
          !e.settled
      )
      .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0);

    // Weekly cash in
    const cashInThisWeek = entries
      .filter(
        (e) =>
          e.entry_type === "Cash IN" &&
          e.entry_date >= weekAgo &&
          e.entry_date <= today
      )
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // Recent entries summary
    const recentEntries = entries.slice(0, 10).map((e) => ({
      type: e.entry_type,
      category: e.category,
      amount: e.amount,
      date: e.entry_date,
      party: e.party?.name || "No party",
      notes: e.notes || "",
    }));

    // Parties summary
    const partiesSummary = (parties || []).map(
      (p: { name: string; party_type: string; opening_balance: number }) => ({
        name: p.name,
        type: p.party_type,
        openingBalance: p.opening_balance,
      })
    );

    const fmt = (n: number) =>
      `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

    // Build context for Claude
    const bioContext = buildBusinessBioContext(bCtx);
    const businessContext = `
Business: ${profile?.business_name || "Small Business"}
Owner: ${profile?.username || "Business Owner"}
${bioContext}

=== CASH PULSE (Cash-basis) ===
Cash Balance: ${fmt(cashBalance)}
Total Cash IN (all-time): ${fmt(totalCashIn)}
Total Cash OUT (all-time): ${fmt(totalCashOut)}
Cash IN this week: ${fmt(cashInThisWeek)}

=== MONTHLY COMPARISON ===
This Month - Cash IN: ${fmt(monthly.currentMonth.cashIn)}, Cash OUT: ${fmt(monthly.currentMonth.cashOut)}, Balance: ${fmt(monthly.currentMonth.balance)}
Last Month - Cash IN: ${fmt(monthly.lastMonth.cashIn)}, Cash OUT: ${fmt(monthly.lastMonth.cashOut)}, Balance: ${fmt(monthly.lastMonth.balance)}
Change: Cash IN ${monthly.percentChange.cashIn > 0 ? "+" : ""}${monthly.percentChange.cashIn.toFixed(1)}%, Cash OUT ${monthly.percentChange.cashOut > 0 ? "+" : ""}${monthly.percentChange.cashOut.toFixed(1)}%

=== PROFIT LENS (Accrual-basis) ===
Revenue: ${fmt(profitMetrics.revenue)}
COGS: ${fmt(profitMetrics.cogs)}
Gross Profit: ${fmt(profitMetrics.grossProfit)}
Operating Expenses: ${fmt(profitMetrics.operatingExpenses)}
Net Profit: ${fmt(profitMetrics.netProfit)}
Profit Margin: ${profitMetrics.profitMargin.toFixed(1)}%

=== RECEIVABLES & PAYABLES ===
Pending Collections (money owed to you): ${fmt(pendingCollections)}
Pending Bills (you owe): ${fmt(pendingBills)}

=== REMINDERS ===
Overdue: ${overdueReminders.length}${overdueReminders.length > 0 ? ` (${overdueReminders.map((r: { title: string }) => r.title).join(", ")})` : ""}
Upcoming this week: ${upcomingReminders.length}${upcomingReminders.length > 0 ? ` (${upcomingReminders.map((r: { title: string }) => r.title).join(", ")})` : ""}
Total pending: ${(reminders || []).length}

=== PARTIES ===
Total: ${partiesSummary.length}
${partiesSummary.length > 0 ? partiesSummary.map((p: { name: string; type: string }) => `- ${p.name} (${p.type})`).join("\n") : "No parties yet"}

=== RECENT ENTRIES (last 10) ===
${recentEntries.length > 0 ? recentEntries.map((e) => `- ${e.date}: ${e.type} | ${e.category} | ${fmt(e.amount)} | ${e.party}${e.notes ? ` | ${e.notes}` : ""}`).join("\n") : "No entries yet"}

=== SYSTEM RECOMMENDATIONS ===
${recommendations.length > 0 ? recommendations.join("\n") : "No recommendations at this time."}
`.trim();

    // Build conversation messages
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    // Convert history + new message into Claude format
    const conversationMessages: Anthropic.MessageParam[] = [];

    // Add conversation history (limit to last 10 exchanges)
    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      conversationMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add the new user message
    conversationMessages.push({
      role: "user",
      content: message,
    });

    // Use the dedicated chat prompt with 3-part structure
    const fullPrompt = buildDonnaChatPrompt(businessContext, message);

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 400,
      system: fullPrompt,
      messages: conversationMessages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    let reply = textBlock ? textBlock.text.trim() : "Sorry, I couldn't generate a response. Please try again.";

    // Strip any markdown formatting that slipped through
    reply = reply
      .replace(/\*\*(.*?)\*\*/g, "$1")   // **bold** → bold
      .replace(/\*(.*?)\*/g, "$1")         // *italic* → italic
      .replace(/^#{1,6}\s+/gm, "")        // ## headers → plain text
      .replace(/```[\s\S]*?```/g, "")      // code blocks → remove
      .replace(/`([^`]+)`/g, "$1")         // inline code → plain
      .trim();

    // Safety net: replace banned words
    reply = reply
      .replace(/urgent/gi, "worth looking at")
      .replace(/you need to/gi, "you could")
      .replace(/you must/gi, "one option is")
      .replace(/crushing/gi, "higher than")
      .replace(/₹-(\d)/g, "short by ₹$1")
      .replace(/-(\d+\.?\d*)%/g, "negative")
      .replace(/(\d+\.\d+)%/g, (_match, p1) => Math.round(parseFloat(p1)) + "%")
      .trim();

    if (!reply || reply.length < 10) {
      reply = "I don't have enough data to answer that clearly yet. Try adding more entries and I'll give you a better picture!";
    }

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
        feature: "chat",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        cost_usd:
          (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15,
        model: "claude-sonnet-4-5-20250929",
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      // Don't fail the response if logging fails
      console.error("[Donna Chat] Usage log error:", logErr);
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("[Donna Chat] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
