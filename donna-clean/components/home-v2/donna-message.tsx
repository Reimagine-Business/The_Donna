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

interface DonnaMessageProps {
  entries: Entry[];
  reminders: Reminder[];
}

interface DonnaInsight {
  emoji: string;
  message: string;
  priority: number; // 1=critical, 2=warning, 3=info, 4=success
}

export function DonnaMessage({ entries, reminders = [] }: DonnaMessageProps) {
  const insight = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const fmt = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

    // 1. Overdue reminders
    const overdueReminders = reminders.filter(
      (r) => r.status === "pending" && r.due_date < today
    );
    if (overdueReminders.length > 0) {
      return {
        emoji: "😰",
        message:
          overdueReminders.length === 1
            ? `You have an overdue reminder: "${overdueReminders[0].title}". Let's take care of it today!`
            : `You have ${overdueReminders.length} overdue reminders. The oldest is "${overdueReminders[0].title}". Let's clear these out!`,
        priority: 1,
      } as DonnaInsight;
    }

    // 2. Overdue bills
    const overdueBills = entries.filter(
      (e) =>
        e.entry_type === "Credit" &&
        e.category !== "Sales" &&
        !e.settled &&
        e.entry_date < today
    );
    if (overdueBills.length > 0) {
      const total = overdueBills.reduce(
        (sum, e) => sum + (e.remaining_amount || e.amount || 0),
        0
      );
      return {
        emoji: "😰",
        message: `You have ${overdueBills.length} overdue bill${overdueBills.length > 1 ? "s" : ""} totaling ${fmt(total)}. I'd recommend settling these soon to keep your business healthy.`,
        priority: 1,
      } as DonnaInsight;
    }

    // 3. Low cash balance
    const cashBalance = entries
      .filter(
        (e) => e.entry_type === "Cash IN" || e.entry_type === "Cash OUT"
      )
      .reduce((sum, e) => {
        return e.entry_type === "Cash IN"
          ? sum + (e.amount || 0)
          : sum - (e.amount || 0);
      }, 0);

    if (cashBalance < 1000 && cashBalance > 0) {
      return {
        emoji: "😰",
        message: `Your cash balance is critically low at ${fmt(cashBalance)}. Consider following up on pending collections or reducing expenses.`,
        priority: 1,
      } as DonnaInsight;
    }

    if (cashBalance < 5000 && cashBalance > 0) {
      return {
        emoji: "😟",
        message: `Your cash balance is ${fmt(cashBalance)}, which is getting low. Keep an eye on your outflows this week.`,
        priority: 2,
      } as DonnaInsight;
    }

    // 4. Upcoming reminders
    const oneWeekFromNow = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];
    const upcomingReminders = reminders.filter(
      (r) =>
        r.status === "pending" &&
        r.due_date >= today &&
        r.due_date <= oneWeekFromNow
    );
    if (upcomingReminders.length > 0) {
      const daysUntil = Math.ceil(
        (new Date(upcomingReminders[0].due_date).getTime() -
          new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const when =
        daysUntil === 0
          ? "today"
          : daysUntil === 1
            ? "tomorrow"
            : `in ${daysUntil} days`;
      return {
        emoji: "🤔",
        message:
          upcomingReminders.length === 1
            ? `Reminder: "${upcomingReminders[0].title}" is due ${when}. Don't forget!`
            : `You have ${upcomingReminders.length} reminders coming up this week. The next one is due ${when}.`,
        priority: 2,
      } as DonnaInsight;
    }

    // 5. Pending collections
    const pendingCollections = entries.filter(
      (e) =>
        e.entry_type === "Credit" &&
        e.category === "Sales" &&
        !e.settled &&
        (e.remaining_amount || e.amount) > 0
    );
    if (pendingCollections.length > 0) {
      const total = pendingCollections.reduce(
        (sum, e) => sum + (e.remaining_amount || e.amount || 0),
        0
      );
      return {
        emoji: "🤔",
        message: `You have ${fmt(total)} in pending collections across ${pendingCollections.length} invoice${pendingCollections.length > 1 ? "s" : ""}. A gentle follow-up could help improve your cash flow!`,
        priority: 3,
      } as DonnaInsight;
    }

    // 6. Strong daily cash inflow
    const todayCashIn = entries
      .filter((e) => e.entry_type === "Cash IN" && e.entry_date === today)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    if (todayCashIn >= 5000) {
      return {
        emoji: "🤩",
        message: `Great day! You've received ${fmt(todayCashIn)} in cash inflows today. Keep the momentum going!`,
        priority: 4,
      } as DonnaInsight;
    }

    // 7. Healthy cash
    if (cashBalance >= 10000) {
      return {
        emoji: "😊",
        message: `Your cash balance is healthy at ${fmt(cashBalance)}. Your business is in a great position!`,
        priority: 4,
      } as DonnaInsight;
    }

    // Default
    return null;
  }, [entries, reminders]);

  const additionalCount = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let count = 0;

    const overdueReminders = reminders.filter(
      (r) => r.status === "pending" && r.due_date < today
    );
    const overdueBills = entries.filter(
      (e) =>
        e.entry_type === "Credit" &&
        e.category !== "Sales" &&
        !e.settled &&
        e.entry_date < today
    );
    const pendingCollections = entries.filter(
      (e) =>
        e.entry_type === "Credit" &&
        e.category === "Sales" &&
        !e.settled
    );
    const oneWeekFromNow = new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .split("T")[0];
    const upcomingReminders = reminders.filter(
      (r) =>
        r.status === "pending" &&
        r.due_date >= today &&
        r.due_date <= oneWeekFromNow
    );

    if (overdueReminders.length > 0) count++;
    if (overdueBills.length > 0) count++;
    if (pendingCollections.length > 0) count++;
    if (upcomingReminders.length > 0) count++;

    return Math.max(0, count - 1);
  }, [entries, reminders]);

  // Highlight ₹ amounts
  const highlightAmounts = (text: string) => {
    const parts = text.split(/(₹[\d,]+)/g);
    return parts.map((part, i) =>
      part.startsWith("₹") ? (
        <span key={i} className="text-white font-bold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  // No insight — everything is good
  if (!insight) {
    return (
      <div>
        <p className="text-white/90 text-sm leading-relaxed">
          Your business is looking good! Keep up the great work. I'll let you
          know if I notice anything important.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-white/90 text-sm leading-relaxed mb-3">
        {highlightAmounts(insight.message)}
      </p>

      {additionalCount > 0 && (
        <Link
          href="/alerts"
          className="inline-flex items-center gap-2 text-[#22d3ee] hover:text-white transition-colors text-sm font-medium"
        >
          +{additionalCount} more update{additionalCount !== 1 ? "s" : ""} →
        </Link>
      )}
    </div>
  );
}
