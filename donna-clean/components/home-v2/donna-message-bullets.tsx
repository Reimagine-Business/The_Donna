"use client";

import { useMemo, useState, useEffect } from "react";
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
  const [loading, setLoading] = useState(true);
  const [showReminders, setShowReminders] = useState(false);

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

  // Pending reminders for pill display (overdue + upcoming this week)
  const pendingReminders = useMemo(() => {
    const oneWeekFromNow = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];
    return reminders.filter(
      (r) =>
        r.status === "pending" &&
        r.due_date <= oneWeekFromNow
    );
  }, [reminders]);

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
      bullets.push(`Check pending bills of ${fmt(pendingTotal)}`);
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

    return bullets;
  }, [entries]);

  const handleOpenChat = () => {
    window.dispatchEvent(new CustomEvent("openDonnaChat"));
  };

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
  const bullets = aiBullets || fallback;

  if (bullets.length === 0) {
    return (
      <div>
        <p className="text-[#e9d5ff] text-sm">
          Everything is looking good! I&apos;ll let you know if anything needs your attention.
        </p>

        {/* Ask Donna prompt — even when no bullets */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'rgba(192,132,252,0.1)' }}>
          <p className="text-[#94a3b8] opacity-50 text-xs italic">
            Ask Donna anything about your business...
          </p>
          <button
            onClick={handleOpenChat}
            className="text-[#c084fc] hover:text-[#e9d5ff] text-xs font-semibold transition-colors flex items-center gap-1"
          >
            Chat
            <span className="text-xs">→</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Insight bullets */}
      {bullets.map((bullet, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#a855f7] flex-shrink-0" style={{ boxShadow: '0 0 8px #a855f7' }} />
          <p className="text-[#e9d5ff] text-sm leading-relaxed">
            {bullet}
          </p>
        </div>
      ))}

      {/* Reminders pill - always visible when reminders exist */}
      {pendingReminders.length > 0 && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(192,132,252,0.1)' }}>
          <button
            onClick={() => setShowReminders(!showReminders)}
            className="flex items-center gap-2 text-[#c084fc] hover:text-[#e9d5ff] transition-colors"
          >
            <span className="text-sm">📅</span>
            <span className="text-xs font-medium">
              {pendingReminders.length} reminder{pendingReminders.length > 1 ? "s" : ""} this week
            </span>
            <span className="text-xs text-[#94a3b8] ml-1">
              {showReminders ? "↑ hide" : "→ see"}
            </span>
          </button>

          {/* Expanded reminders */}
          {showReminders && (
            <div className="mt-2 space-y-1">
              {pendingReminders.map((reminder) => (
                <p key={reminder.id} className="text-[#e9d5ff]/60 text-xs pl-5">
                  • {reminder.title}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ask Donna prompt */}
      <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'rgba(192,132,252,0.1)' }}>
        <p className="text-[#94a3b8] opacity-50 text-xs italic">
          Ask Donna anything about your business...
        </p>
        <button
          onClick={handleOpenChat}
          className="text-[#c084fc] hover:text-[#e9d5ff] text-xs font-semibold transition-colors flex items-center gap-1"
        >
          Chat
          <span className="text-xs">→</span>
        </button>
      </div>
    </div>
  );
}
