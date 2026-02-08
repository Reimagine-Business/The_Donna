"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Entry } from "@/lib/entries";

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: string;
  category: string;
}

interface DonnaMessageBulletsProps {
  entries: Entry[];
  reminders: Reminder[];
}

export function DonnaMessageBullets({ entries, reminders = [] }: DonnaMessageBulletsProps) {
  const fmt = (amount: number) =>
    `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

  const insights = useMemo(() => {
    const today = new Date();
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const todayStr = today.toISOString().split("T")[0];
    const weekAgoStr = weekAgo.toISOString().split("T")[0];
    const bullets: { text: string; bold: string; amount: string; emoji?: string; extra?: string }[] = [];

    // Cash IN this week
    const cashInThisWeek = entries
      .filter(
        (e) =>
          e.entry_type === "Cash IN" &&
          e.entry_date >= weekAgoStr &&
          e.entry_date <= todayStr
      )
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    if (cashInThisWeek > 0) {
      bullets.push({
        bold: "Cash IN",
        text: " is good this week at ",
        amount: fmt(cashInThisWeek),
      });
    }

    // Pending bills (Credit entries for COGS/Opex that are unsettled)
    const pendingBills = entries.filter(
      (e) =>
        e.entry_type === "Credit" &&
        ["COGS", "Opex"].includes(e.category) &&
        !e.settled
    );
    const pendingTotal = pendingBills.reduce(
      (sum, e) => sum + (e.remaining_amount ?? e.amount ?? 0),
      0
    );

    if (pendingTotal > 0) {
      bullets.push({
        bold: "",
        text: "Check pending bills of ",
        amount: fmt(pendingTotal),
        emoji: "📅",
      });
    }

    // Profit from sales
    const salesRevenue = entries
      .filter((e) => e.entry_type === "Cash IN" && e.category === "Sales")
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const salesCOGS = entries
      .filter((e) => e.entry_type === "Cash OUT" && e.category === "COGS")
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = salesRevenue - salesCOGS;

    if (profit > 0) {
      bullets.push({
        bold: "Profit from sales",
        text: " looks good at ",
        amount: fmt(profit),
      });
    }

    // Count additional insights for "+N more update" link
    let additionalCount = 0;
    const overdueReminders = reminders.filter(
      (r) => r.status === "pending" && r.due_date < todayStr
    );
    const oneWeekFromNow = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];
    const upcomingReminders = reminders.filter(
      (r) =>
        r.status === "pending" &&
        r.due_date >= todayStr &&
        r.due_date <= oneWeekFromNow
    );
    if (overdueReminders.length > 0) additionalCount++;
    if (upcomingReminders.length > 0) additionalCount++;

    return { bullets, additionalCount };
  }, [entries, reminders]);

  if (insights.bullets.length === 0) {
    return (
      <p className="text-white/90 text-sm">
        Everything is looking good! I'll let you know if anything needs your attention.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {insights.bullets.map((bullet, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-white mt-0.5 text-lg leading-none">•</span>
          <p className="text-white text-sm leading-relaxed">
            {bullet.bold && (
              <span className="font-semibold">{bullet.bold}</span>
            )}
            {bullet.text}
            <span className="font-bold">{bullet.amount}</span>
            {bullet.emoji && ` ${bullet.emoji}`}
            {/* Show "+N more update" on the last bullet */}
            {i === insights.bullets.length - 1 && insights.additionalCount > 0 && (
              <Link
                href="/alerts"
                className="ml-2 text-[#c084fc] hover:text-white transition-colors text-xs font-medium"
              >
                +{insights.additionalCount} more update{insights.additionalCount !== 1 ? "s" : ""} →
              </Link>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
