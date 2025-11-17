"use client";

import { useMemo, useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { createClient } from "@/lib/supabase/client";
import { Entry, normalizeEntry } from "@/lib/entries";
import { cn } from "@/lib/utils";

type ProfitLensShellProps = {
  initialEntries: Entry[];
  userId: string;
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
});

const percentageFormatter = (value: number) =>
  Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "—";

const currentStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
const currentEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

type FiltersState = {
  start_date: string;
  end_date: string;
};

export function ProfitLensShell({ initialEntries, userId }: ProfitLensShellProps) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[]>(initialEntries.map(normalizeEntry));
  const [filters, setFilters] = useState<FiltersState>({
    start_date: currentStart,
    end_date: currentEnd,
  });

  useEffect(() => {
    const channel = supabase
      .channel("profit-lens")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "entries",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setEntries((prev) => {
            switch (payload.eventType) {
              case "INSERT": {
                const newEntry = normalizeEntry(payload.new);
                if (prev.some((entry) => entry.id === newEntry.id)) {
                  return prev.map((entry) => (entry.id === newEntry.id ? newEntry : entry));
                }
                return [newEntry, ...prev];
              }
              case "UPDATE": {
                const updated = normalizeEntry(payload.new);
                return prev.map((entry) => (entry.id === updated.id ? updated : entry));
              }
              case "DELETE": {
                const deletedId = (payload.old as Entry).id;
                return prev.filter((entry) => entry.id !== deletedId);
              }
              default:
                return prev;
            }
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const stats = useMemo(() => buildProfitStats(entries, filters), [entries, filters]);

  return (
    <div className="flex flex-col gap-8 text-white">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Donna · Profit Lens</p>
        <h1 className="text-3xl font-semibold">Monthly profit & loss</h1>
        <p className="text-sm text-slate-400">
          See how sales convert into margins across every cost bucket.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Sales" value={currencyFormatter.format(stats.sales)} variant="positive" />
        <SummaryCard label="COGS" value={currencyFormatter.format(stats.cogs)} variant="negative" />
        <SummaryCard label="Gross Profit" value={currencyFormatter.format(stats.grossProfit)} variant="neutral" />
        <SummaryCard label="Opex" value={currencyFormatter.format(stats.opex)} variant="negative" />
        <SummaryCard
          label="Net Profit"
          value={currencyFormatter.format(stats.netProfit)}
          variant="highlight"
        />
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-widest text-slate-400">Margins</p>
          <div className="mt-4 space-y-3 text-white">
            <div>
              <p className="text-sm text-slate-400">Gross Margin</p>
              <p className="text-2xl font-semibold">{percentageFormatter(stats.grossMargin)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Net Margin</p>
              <p className="text-2xl font-semibold">{percentageFormatter(stats.netMargin)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase text-slate-400">Period</p>
            <h2 className="text-lg font-semibold">Date range</h2>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <div>
              <p className="text-xs uppercase text-slate-400">From</p>
              <input
                type="date"
                value={filters.start_date}
                max={filters.end_date}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    start_date: event.target.value,
                  }))
                }
                className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a78bfa]"
              />
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">To</p>
              <input
                type="date"
                value={filters.end_date}
                min={filters.start_date}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    end_date: event.target.value,
                  }))
                }
                className="rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#a78bfa]"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setFilters({
                  start_date: currentStart,
                  end_date: currentEnd,
                })
              }
              className="mt-4 rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-[#a78bfa]/60 hover:text-white"
            >
              Reset to current month
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-xs uppercase text-slate-400">Expense breakdown</p>
            <h3 className="text-lg font-semibold">Top 5 spend buckets</h3>
            <div className="mt-5 h-72">
              {stats.topExpenses.length === 0 ? (
                <p className="text-sm text-slate-400">No expenses recorded in this range.</p>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={stats.topExpenses} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis type="number" stroke="#94a3b8" />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" />
                    <Tooltip
                      formatter={(value: number) => currencyFormatter.format(value ?? 0)}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderRadius: "0.75rem",
                        border: "1px solid rgba(255,255,255,0.1)",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="value" fill="#a78bfa" radius={[0, 12, 12, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
            <p className="text-xs uppercase text-slate-400">Total sales</p>
            <h3 className="mt-3 text-4xl font-semibold text-white">
              {currencyFormatter.format(stats.sales)}
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Includes both cash inflow and credit sales within this range.
            </p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>COGS</span>
                <span className="text-rose-300">{currencyFormatter.format(stats.cogs)}</span>
              </div>
              <div className="flex justify-between">
                <span>Opex</span>
                <span className="text-rose-300">{currencyFormatter.format(stats.opex)}</span>
              </div>
              <div className="flex justify-between">
                <span>Net profit</span>
                <span className="text-[#a78bfa]">{currencyFormatter.format(stats.netProfit)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

type SummaryVariant = "positive" | "negative" | "neutral" | "highlight";

const summaryColors: Record<SummaryVariant, string> = {
  positive: "from-emerald-500/30 to-emerald-500/5 border-emerald-500/40",
  negative: "from-rose-500/30 to-rose-500/5 border-rose-500/40",
  neutral: "from-white/20 to-white/5 border-white/20",
  highlight: "from-[#a78bfa]/40 to-[#a78bfa]/10 border-[#a78bfa]/50",
};

type SummaryCardProps = {
  label: string;
  value: string;
  variant: SummaryVariant;
};

function SummaryCard({ label, value, variant }: SummaryCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-5 shadow-xl shadow-black/40",
        summaryColors[variant],
      )}
    >
      <p className="text-xs uppercase tracking-[0.3em] text-white/70">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

type ProfitStats = {
  sales: number;
  cogs: number;
  opex: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  topExpenses: { name: string; value: number }[];
};

const buildProfitStats = (entries: Entry[], filters: FiltersState): ProfitStats => {
  const filtered = entries.filter(
    (entry) => entry.entry_date >= filters.start_date && entry.entry_date <= filters.end_date,
  );

  const isCredit = (entry: Entry) => entry.entry_type === "Credit";
  const sales = filtered.reduce((sum, entry) => {
    if (entry.category === "Sales" && (entry.entry_type === "Cash Inflow" || isCredit(entry))) {
      return sum + entry.amount;
    }
    return sum;
  }, 0);

  const cogs = filtered.reduce((sum, entry) => {
    if (entry.category === "COGS" && (entry.entry_type === "Cash Outflow" || isCredit(entry))) {
      return sum + entry.amount;
    }
    return sum;
  }, 0);

  const opex = filtered.reduce((sum, entry) => {
    if (entry.category === "Opex" && (entry.entry_type === "Cash Outflow" || isCredit(entry))) {
      return sum + entry.amount;
    }
    return sum;
  }, 0);

  const grossProfit = sales - cogs;
  const netProfit = grossProfit - opex;

  const expenseMap: Record<string, number> = {};
  filtered.forEach((entry) => {
    if (
      (entry.category === "COGS" || entry.category === "Opex") &&
      (entry.entry_type === "Cash Outflow" || isCredit(entry))
    ) {
      expenseMap[entry.category] = (expenseMap[entry.category] ?? 0) + entry.amount;
    }
  });

  const topExpenses = Object.entries(expenseMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    sales,
    cogs,
    opex,
    grossProfit,
    netProfit,
    grossMargin: sales > 0 ? grossProfit / sales : NaN,
    netMargin: sales > 0 ? netProfit / sales : NaN,
    topExpenses,
  };
};
