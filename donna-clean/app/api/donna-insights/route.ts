import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import { getEntries } from "@/app/entries/actions";
import { calculateCashBalance, getMonthlyComparison, getTotalCashIn, getTotalCashOut } from "@/lib/analytics-new";
import { getProfitMetrics, getRecommendations } from "@/lib/profit-calculations-new";
import { buildDonnaPrompt } from "@/lib/donna-personality";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Auth check
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all data
    const { entries } = await getEntries();
    const { data: reminders } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("due_date", { ascending: true });

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fetch business profile for personalized context
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("business_context")
      .eq("user_id", user.id)
      .maybeSingle();
    const bCtx = businessProfile?.business_context || {};

    // Compute metrics from all features
    const cashBalance = calculateCashBalance(entries);
    const totalCashIn = getTotalCashIn(entries);
    const totalCashOut = getTotalCashOut(entries);
    const monthly = getMonthlyComparison(entries);
    const profitMetrics = getProfitMetrics(entries);
    const recommendations = getRecommendations(entries);

    const today = new Date().toISOString().split("T")[0];
    const overdueReminders = (reminders || []).filter(
      (r: { status: string; due_date: string }) => r.status === "pending" && r.due_date < today
    );
    const upcomingReminders = (reminders || []).filter(
      (r: { status: string; due_date: string }) => {
        const oneWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
        return r.status === "pending" && r.due_date >= today && r.due_date <= oneWeek;
      }
    );

    // Pending collections and bills
    const pendingCollections = entries
      .filter((e) => e.entry_type === "Credit" && e.category === "Sales" && !e.settled)
      .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0);
    const pendingBills = entries
      .filter((e) => e.entry_type === "Credit" && ["COGS", "Opex"].includes(e.category) && !e.settled)
      .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0);

    // Weekly cash in
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const cashInThisWeek = entries
      .filter((e) => e.entry_type === "Cash IN" && e.entry_date >= weekAgo && e.entry_date <= today)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

    // Build the business summary for Claude
    const businessSummary = `
Business: ${profile?.business_name || "Small Business"}
${bCtx.what_we_sell ? `What they sell: ${bCtx.what_we_sell}` : ""}
${bCtx.main_customers ? `Main customers: ${bCtx.main_customers}` : ""}
${bCtx.peak_season ? `Peak season: ${bCtx.peak_season}` : ""}
${bCtx.typical_monthly_costs ? `Typical monthly costs: ${bCtx.typical_monthly_costs}` : ""}
${bCtx.business_goals ? `Business goals: ${bCtx.business_goals}` : ""}

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
Overdue reminders: ${overdueReminders.length}${overdueReminders.length > 0 ? ` (${overdueReminders.map((r: { title: string }) => r.title).join(", ")})` : ""}
Upcoming this week: ${upcomingReminders.length}${upcomingReminders.length > 0 ? ` (${upcomingReminders.map((r: { title: string }) => r.title).join(", ")})` : ""}
Total pending: ${(reminders || []).length}

=== SYSTEM RECOMMENDATIONS ===
${recommendations.length > 0 ? recommendations.join("\n") : "No recommendations at this time."}
`.trim();

    // Call Claude for AI insights
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // Build Donna's full personality + business context
    const insightsContext = `${businessSummary}

TASK: Generate exactly 3 short bullet-point insights for the HOME PAGE.

RULES:
- Each bullet must be ONE sentence only (max 12 words)
- Be specific - use their actual numbers with ₹ symbol
- Prioritize: overdue items > cash warnings > good news
- Reference app features: Cash Pulse, Profit Lens, Alerts, Entries
- If cash is low, warn them. If profit is good, celebrate with 🎉
- If this is their best month, CELEBRATE

Respond with ONLY a JSON array of 3 strings, no markdown, no explanation. Example:
["Cash IN is strong at ₹42,000 this week — check Cash Pulse for the trend","Pending bills of ₹7,500 need attention — view in Entries","Profit margin at 23% is healthy — see Profit Lens for details"]`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 250,
      system: buildDonnaPrompt(insightsContext),
      messages: [
        {
          role: "user",
          content: "Generate the 3 insights now.",
        },
      ],
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

    // Parse the AI response — strip markdown code blocks if present
    const textBlock = response.content.find((b) => b.type === "text");
    let rawText = textBlock ? textBlock.text.trim() : "[]";

    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    rawText = rawText.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    rawText = rawText.trim();

    let bullets: string[];
    try {
      bullets = JSON.parse(rawText);
      if (!Array.isArray(bullets)) throw new Error("Not an array");
      // Strip any leftover markdown formatting from each bullet
      bullets = bullets
        .map((b) => String(b).replace(/\*\*/g, "").replace(/^#+\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 3);
    } catch {
      // Fallback: try to extract JSON array from anywhere in the response
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          bullets = JSON.parse(jsonMatch[0]);
          if (!Array.isArray(bullets)) throw new Error("Not an array");
          bullets = bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 3);
        } catch {
          bullets = [];
        }
      } else {
        bullets = [];
      }
    }

    return NextResponse.json({
      bullets,
      additionalCount: Math.max(0, overdueReminders.length + upcomingReminders.length - 1),
    });
  } catch (error) {
    console.error("[Donna AI] Error:", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}
