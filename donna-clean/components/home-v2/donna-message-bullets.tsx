"use client";

import { useMemo, useState, useEffect } from "react";
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
  const [aiBullets, setAiBullets] = useState<string[] | null>(null);
  const [aiAdditional, setAiAdditional] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch AI-powered insights
  useEffect(() => {
    let cancelled = false;

    async function fetchAiInsights() {
      try {
        const res = await fetch("/api/donna-insights");
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        if (!cancelled && data.bullets && data.bullets.length > 0) {
          setAiBullets(data.bullets);
          setAiAdditional(data.additionalCount || 0);
        }
      } catch {
        // AI failed — fallback to rule-based insights below
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAiInsights();
    return () => { cancelled = true; };
  }, []);

  // Fallback: basic rule-based insights (used if AI is unavailable)
  const fallback = useMemo(() => {
    const fmt = (amount: number) =>
      `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

    const today = new Date();
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const todayStr = today.toISOString().split("T")[0];
    const weekAgoStr = weekAgo.toISOString().split("T")[0];
    const bullets: string[] = [];

    const cashInThisWeek = entries
      .filter(
        (e) =>
          e.entry_type === "Cash IN" &&
          e.entry_date >= weekAgoStr &&
          e.entry_date <= todayStr
      )
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    if (cashInThisWeek > 0) {
      bullets.push(`Cash IN is good this week at ${fmt(cashInThisWeek)}`);
    }

    const pendingTotal = entries
      .filter(
        (e) =>
          e.entry_type === "Credit" &&
          ["COGS", "Opex"].includes(e.category) &&
          !e.settled
      )
      .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount ?? 0), 0);

    if (pendingTotal > 0) {
      bullets.push(`Check pending bills of ${fmt(pendingTotal)} 📅`);
    }

    const salesRevenue = entries
      .filter((e) => e.entry_type === "Cash IN" && e.category === "Sales")
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const salesCOGS = entries
      .filter((e) => e.entry_type === "Cash OUT" && e.category === "COGS")
      .reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = salesRevenue - salesCOGS;

    if (profit > 0) {
      bullets.push(`Profit from sales looks good at ${fmt(profit)}`);
    }

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

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-[90%]" />
        <div className="h-4 bg-white/10 rounded w-[75%]" />
        <div className="h-4 bg-white/10 rounded w-[85%]" />
      </div>
    );
  }

  // Use AI bullets if available, otherwise fallback
  const bullets = aiBullets || fallback.bullets;
  const additionalCount = aiBullets ? aiAdditional : fallback.additionalCount;

  if (bullets.length === 0) {
    return (
      <p className="text-white/90 text-sm">
        Everything is looking good! I'll let you know if anything needs your attention.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {bullets.map((bullet, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-white mt-0.5 text-lg leading-none">•</span>
          <p className="text-white text-sm leading-relaxed">
            {bullet}
            {/* Show "+N more update" on the last bullet */}
            {i === bullets.length - 1 && additionalCount > 0 && (
              <Link
                href="/alerts"
                className="ml-2 text-[#c084fc] hover:text-white transition-colors text-xs font-medium"
              >
                +{additionalCount} more update{additionalCount !== 1 ? "s" : ""} →
              </Link>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
