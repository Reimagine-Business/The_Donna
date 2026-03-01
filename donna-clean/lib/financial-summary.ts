import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Build a compact financial summary string for Donna AI prompts.
 * Uses pre-calculated summaries instead of raw entries to reduce token usage.
 */
export async function buildFinancialSummary(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const now = new Date();

  // Current month boundaries
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;

  // Current week boundaries (Monday to today)
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekStart = monday.toISOString().split("T")[0];
  const today = now.toISOString().split("T")[0];

  // Last month boundaries
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = lastMonthDate.toISOString().split("T")[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

  // Fetch current month entries
  const { data: monthEntries } = await supabase
    .from("entries")
    .select("entry_type, amount, category, party:parties(name), entry_date")
    .eq("user_id", userId)
    .gte("entry_date", monthStart)
    .lte("entry_date", monthEnd);

  // Fetch current week entries
  const { data: weekEntries } = await supabase
    .from("entries")
    .select("entry_type, amount, entry_date")
    .eq("user_id", userId)
    .gte("entry_date", weekStart)
    .lte("entry_date", today);

  // Fetch last month entries
  const { data: lastMonthEntries } = await supabase
    .from("entries")
    .select("entry_type, amount")
    .eq("user_id", userId)
    .gte("entry_date", lastMonthStart)
    .lte("entry_date", lastMonthEnd);

  // Fetch pending (unsettled Credit/Advance) — include category to match dashboard logic
  const { data: pendingEntries } = await supabase
    .from("entries")
    .select("entry_type, amount, remaining_amount, category")
    .eq("user_id", userId)
    .eq("settled", false)
    .in("entry_type", ["Credit", "Advance"]);

  // Fetch reminders
  const { data: reminders } = await supabase
    .from("reminders")
    .select("title, due_date, status")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  // Calculate current month
  const monthIn = (monthEntries || [])
    .filter((e) => e.entry_type === "Cash IN" || e.entry_type === "Credit")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const monthOut = (monthEntries || [])
    .filter((e) => e.entry_type === "Cash OUT" || e.entry_type === "Advance")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Find top expense category
  const expenseByCategory: Record<string, number> = {};
  (monthEntries || [])
    .filter((e) => e.entry_type === "Cash OUT" || e.entry_type === "Advance")
    .forEach((e) => {
      const cat = e.category || "Other";
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + e.amount;
    });
  const topExpense =
    Object.entries(expenseByCategory)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || "None";

  // Find top income source
  const incomeByParty: Record<string, number> = {};
  (monthEntries || [])
    .filter((e) => e.entry_type === "Cash IN" || e.entry_type === "Credit")
    .forEach((e) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const partyData = e.party as any;
      const party = partyData?.name || e.category || "Other";
      incomeByParty[party] = (incomeByParty[party] || 0) + e.amount;
    });
  const topIncome =
    Object.entries(incomeByParty)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || "None";

  // Calculate week
  const weekIn = (weekEntries || [])
    .filter((e) => e.entry_type === "Cash IN" || e.entry_type === "Credit")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const weekOut = (weekEntries || [])
    .filter((e) => e.entry_type === "Cash OUT" || e.entry_type === "Advance")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Calculate last month
  const lastIn = (lastMonthEntries || [])
    .filter((e) => e.entry_type === "Cash IN" || e.entry_type === "Credit")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const lastOut = (lastMonthEntries || [])
    .filter((e) => e.entry_type === "Cash OUT" || e.entry_type === "Advance")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Calculate pending — must match dashboard logic exactly
  // Pending Collections = Credit Sales only (money owed TO you)
  const pendingCollections = (pendingEntries || [])
    .filter((e) => e.entry_type === "Credit" && e.category === "Sales")
    .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount ?? 0), 0);

  // Pending Bills = Credit COGS/Opex/Assets (money YOU owe)
  const pendingBills = (pendingEntries || [])
    .filter((e) => e.entry_type === "Credit" && ["COGS", "Opex", "Assets"].includes(e.category))
    .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount ?? 0), 0);

  // Pending Advance Payments = Advance entries (money committed either way)
  const pendingPayments = (pendingEntries || [])
    .filter((e) => e.entry_type === "Advance")
    .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount ?? 0), 0);

  // Reminders
  const overdueReminders = (reminders || []).filter(
    (r) => r.status === "pending" && r.due_date < today
  );
  const oneWeekFromNow = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const upcomingReminders = (reminders || []).filter(
    (r) => r.status === "pending" && r.due_date >= today && r.due_date <= oneWeekFromNow
  );

  // Format
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const currentMonthName = monthNames[now.getMonth()];
  const lastMonthName = monthNames[now.getMonth() === 0 ? 11 : now.getMonth() - 1];
  const year = now.getFullYear();
  const daysIntoMonth = now.getDate();
  const daysInMonth = lastDayOfMonth;

  const netWeek = weekIn - weekOut;
  const netMonth = monthIn - monthOut;
  const netLast = lastIn - lastOut;

  const summary = `TODAY: ${now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} (Day ${daysIntoMonth} of ${daysInMonth})

THIS WEEK:
- Cash in: ${fmt(weekIn)}
- Cash out: ${fmt(weekOut)}
- Net: ${netWeek >= 0 ? `${fmt(netWeek)} ahead` : `${fmt(Math.abs(netWeek))} behind`}

${currentMonthName.toUpperCase()} ${year} (so far):
- Cash in: ${fmt(monthIn)}
- Cash out: ${fmt(monthOut)}
- Net: ${netMonth >= 0 ? `${fmt(netMonth)} ahead` : `${fmt(Math.abs(netMonth))} behind`}
- Biggest expense: ${topExpense}
- Main income source: ${topIncome}
- Entries recorded: ${(monthEntries || []).length}

${lastMonthName.toUpperCase()} ${year} (comparison):
- Cash in: ${fmt(lastIn)}
- Cash out: ${fmt(lastOut)}
- Net: ${netLast >= 0 ? `${fmt(netLast)} profit` : `${fmt(Math.abs(netLast))} loss`}
${pendingCollections > 0 ? `\nPENDING COLLECTIONS: ${fmt(pendingCollections)} owed to you` : ""}
${pendingBills > 0 ? `PENDING BILLS: ${fmt(pendingBills)} you owe (credit purchases)` : ""}
${pendingPayments > 0 ? `PENDING ADVANCES: ${fmt(pendingPayments)} advance commitments` : ""}
${overdueReminders.length > 0 ? `\nOVERDUE REMINDERS: ${overdueReminders.length} (${overdueReminders.map((r) => r.title).join(", ")})` : ""}
${upcomingReminders.length > 0 ? `UPCOMING THIS WEEK: ${upcomingReminders.length} (${upcomingReminders.map((r) => r.title).join(", ")})` : ""}`.trim();

  return summary;
}

/**
 * For chat — includes 3-month trend for richer context.
 */
export async function buildChatFinancialContext(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const currentSummary = await buildFinancialSummary(supabase, userId);

  // Get 3-month trend
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    .toISOString()
    .split("T")[0];

  const { data: recentEntries } = await supabase
    .from("entries")
    .select("entry_type, amount, entry_date")
    .eq("user_id", userId)
    .gte("entry_date", threeMonthsAgo)
    .order("entry_date", { ascending: false })
    .limit(100);

  // Group by month
  const monthlyTrend: Record<string, { in: number; out: number }> = {};
  (recentEntries || []).forEach((entry) => {
    const month = entry.entry_date?.substring(0, 7);
    if (!month) return;
    if (!monthlyTrend[month]) monthlyTrend[month] = { in: 0, out: 0 };
    if (entry.entry_type === "Cash IN" || entry.entry_type === "Credit") {
      monthlyTrend[month].in += entry.amount || 0;
    } else {
      monthlyTrend[month].out += entry.amount || 0;
    }
  });

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  const trendText = Object.entries(monthlyTrend)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3)
    .map(([month, data]) => `${month}: IN ${fmt(data.in)} | OUT ${fmt(data.out)}`)
    .join("\n");

  return `${currentSummary}

3-MONTH TREND:
${trendText || "Not enough data yet"}`;
}
