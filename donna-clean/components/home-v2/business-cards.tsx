"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Entry } from "@/lib/entries";
import { calculateCashBalance } from "@/lib/analytics-new";
import { getProfitMetrics } from "@/lib/profit-calculations-new";
import {
  PeriodFilter,
  getDateRangeForPeriod,
  type PeriodType,
} from "@/components/common/period-filter";

interface BusinessCardsProps {
  entries: Entry[];
}

export function BusinessCards({ entries }: BusinessCardsProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<PeriodType>("all-time");
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [expandedOwn, setExpandedOwn] = useState(false);
  const [expandedOwe, setExpandedOwe] = useState(false);

  const fmt = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  const snapshotData = useMemo(() => {
    const { start, end } = getDateRangeForPeriod(period, selectedYear);

    // Filter entries for the selected period (for profit calculation)
    const filteredEntries =
      start && end
        ? entries.filter((e) => {
            const entryDate = new Date(e.entry_date);
            return entryDate >= start && entryDate <= end;
          })
        : entries;

    // WHAT YOU OWN (Assets) — same logic as existing BusinessSnapshot
    const cash = calculateCashBalance(entries);

    const receivables = entries
      .filter(
        (e) =>
          e.entry_type === "Credit" && e.category === "Sales" && !e.settled
      )
      .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0);

    const prepaid = entries
      .filter(
        (e) =>
          e.entry_type === "Advance" &&
          ["COGS", "Opex", "Assets"].includes(e.category) &&
          !e.settled
      )
      .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0);

    const fixedAssets = entries
      .filter((e) => e.category === "Assets")
      .reduce((sum, e) => sum + e.amount, 0);

    const totalOwn = cash + receivables + prepaid + fixedAssets;

    // WHAT YOU OWE (Liabilities)
    const creditBills = entries
      .filter(
        (e) =>
          e.entry_type === "Credit" &&
          ["COGS", "Opex"].includes(e.category) &&
          !e.settled
      )
      .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0);

    const customerAdvances = entries
      .filter(
        (e) =>
          e.entry_type === "Advance" &&
          e.category === "Sales" &&
          !e.settled
      )
      .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0);

    const totalOwe = creditBills + customerAdvances;

    // PROFIT — for selected period using Profit Lens logic
    const profitMetrics = getProfitMetrics(
      filteredEntries,
      start ?? undefined,
      end ?? undefined
    );
    const profit = profitMetrics.netProfit;

    return {
      cash,
      receivables,
      prepaid,
      fixedAssets,
      totalOwn,
      creditBills,
      customerAdvances,
      totalOwe,
      profit,
    };
  }, [entries, period, selectedYear]);

  return (
    <div className="space-y-4">
      {/* Section Header + Period Filter */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-3 drop-shadow-md">
          How is your business doing?
        </h2>
        <PeriodFilter
          value={period}
          onChange={setPeriod}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
        />
      </div>

      {/* What's Yours — Premium Purple Gradient */}
      <div className="relative rounded-2xl p-6 border border-purple-500/30 overflow-hidden hover:border-purple-400/50 transition-colors">
        <div className="absolute inset-0 bg-gradient-to-br from-[#4a148c]/60 via-[#7c3aed]/50 to-[#9333ea]/60" />
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-purple-500/5" />

        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-purple-400/30">
            <svg
              className="w-7 h-7 text-purple-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>

          <div className="flex-1">
            <p className="text-purple-300/80 text-sm font-medium uppercase tracking-wide mb-2">
              What's Yours?
            </p>
            <p className="text-4xl font-bold text-white mb-1">
              {fmt(snapshotData.totalOwn)}
            </p>
            <p className="text-purple-200/60 text-sm">
              Total value of everything you own
            </p>
          </div>
        </div>
      </div>

      {/* What's Not Yours + Profit — Side by side with themed gradients */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* What's Not Yours — Rich Burgundy Gradient */}
        <div className="relative rounded-2xl p-5 border border-red-500/30 overflow-hidden hover:border-red-400/50 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-[#7c2d12]/60 via-[#991b1b]/50 to-[#7c2d12]/60" />

          <div className="relative flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-red-400/30">
              <svg
                className="w-6 h-6 text-red-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-red-300/80 text-xs font-medium uppercase tracking-wide mb-1">
                What is Not Yours?
              </p>
              <p className="text-2xl font-bold text-white truncate">
                {fmt(snapshotData.totalOwe)}
              </p>
            </div>
          </div>
        </div>

        {/* Profit from Sales — Rich Blue Gradient */}
        <div className="relative rounded-2xl p-5 border border-blue-500/30 overflow-hidden hover:border-blue-400/50 transition-colors">
          <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a]/60 via-[#3b82f6]/50 to-[#1e40af]/60" />

          <div className="relative flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 backdrop-blur-sm border border-blue-400/30">
              <svg
                className="w-6 h-6 text-blue-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-blue-300/80 text-xs font-medium uppercase tracking-wide mb-1">
                Your Profit From Sales
              </p>
              <p
                className={`text-2xl font-bold truncate ${snapshotData.profit >= 0 ? "text-green-300" : "text-red-300"}`}
              >
                {fmt(snapshotData.profit)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      <div className="space-y-3">
        {/* What You Own Details */}
        <div className="bg-[#1a0033]/60 border border-purple-500/20 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedOwn(!expandedOwn)}
            className="w-full p-3 flex items-center justify-between hover:bg-purple-900/30 transition-colors"
          >
            <span className="text-sm text-white font-medium">
              What's Yours — Breakdown
            </span>
            {expandedOwn ? (
              <ChevronUp className="w-4 h-4 text-purple-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-purple-400" />
            )}
          </button>

          {expandedOwn && (
            <div className="px-3 pb-3 space-y-2 border-t border-purple-500/20">
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-purple-300/60">Cash in Bank/Hand</span>
                <span className="text-sm font-semibold text-white">
                  {fmt(snapshotData.cash)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-purple-300/60">Money to Collect</span>
                <span className="text-sm font-semibold text-white">
                  {fmt(snapshotData.receivables)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-purple-300/60">Advances Paid</span>
                <span className="text-sm font-semibold text-white">
                  {fmt(snapshotData.prepaid)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-purple-300/60">Fixed Assets</span>
                <span className="text-sm font-semibold text-white">
                  {fmt(snapshotData.fixedAssets)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* What You Owe Details */}
        <div className="bg-[#1a0033]/60 border border-purple-500/20 rounded-xl overflow-hidden">
          <button
            onClick={() => setExpandedOwe(!expandedOwe)}
            className="w-full p-3 flex items-center justify-between hover:bg-purple-900/30 transition-colors"
          >
            <span className="text-sm text-white font-medium">
              What's Left to Pay — Breakdown
            </span>
            {expandedOwe ? (
              <ChevronUp className="w-4 h-4 text-purple-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-purple-400" />
            )}
          </button>

          {expandedOwe && (
            <div className="px-3 pb-3 space-y-2 border-t border-purple-500/20">
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-purple-300/60">Bills to Pay</span>
                <span className="text-sm font-semibold text-white">
                  {fmt(snapshotData.creditBills)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-purple-300/60">
                  Customer Advances
                </span>
                <span className="text-sm font-semibold text-white">
                  {fmt(snapshotData.customerAdvances)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => router.push("/analytics/cashpulse")}
          className="py-3 px-4 bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7c3aed] rounded-lg font-medium text-sm transition-all text-white shadow-lg shadow-purple-500/20"
        >
          View Cash Pulse
        </button>
        <button
          onClick={() => router.push("/analytics/profitlens")}
          className="py-3 px-4 bg-gradient-to-r from-[#7c3aed] to-[#9333ea] hover:from-[#6d28d9] hover:to-[#7c3aed] rounded-lg font-medium text-sm transition-all text-white shadow-lg shadow-purple-500/20"
        >
          View Profit Lens
        </button>
      </div>
    </div>
  );
}
