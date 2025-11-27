"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { Entry, normalizeEntry } from "@/lib/entries";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  filterByDateRange,
  filterByCustomDateRange,
  getDateRangeLabel,
  formatCustomDateLabel,
  type DateRange
} from "@/lib/date-utils";
import { formatAmountInWordsShort } from "@/lib/format-number-words";

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

const ENTRY_SELECT =
  "id, user_id, entry_type, category, payment_method, amount, remaining_amount, entry_date, notes, image_url, settled, settled_at, created_at, updated_at";

const MAX_REALTIME_RECONNECT_ATTEMPTS = 5;
const BASE_REALTIME_DELAY_MS = 5000;
const MAX_REALTIME_DELAY_MS = 30000;

export function ProfitLensShell({ initialEntries, userId }: ProfitLensShellProps) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[]>(initialEntries.map(normalizeEntry));
  const [filters, setFilters] = useState<FiltersState>({
    start_date: currentStart,
    end_date: currentEnd,
  });
  const [dateFilter, setDateFilter] = useState("this-month");
  const [showCustomDatePickers, setShowCustomDatePickers] = useState(false);
  const [customFromDate, setCustomFromDate] = useState<Date>();
  const [customToDate, setCustomToDate] = useState<Date>();

  const initialStatsRef = useRef<ProfitStats | null>(null);
  if (!initialStatsRef.current) {
    // Filter initial entries by default date range (this-month)
    const filteredInitial = filterByDateRange(initialEntries, "this-month" as DateRange);
    initialStatsRef.current = buildProfitStats(filteredInitial);
  }
  const initialStats = initialStatsRef.current as ProfitStats;

  const [sales, setSales] = useState(initialStats.sales);
  const [cogs, setCogs] = useState(initialStats.cogs);
  const [opex, setOpex] = useState(initialStats.opex);
  const [grossProfit, setGrossProfit] = useState(initialStats.grossProfit);
  const [netProfit, setNetProfit] = useState(initialStats.netProfit);
  const [grossMargin, setGrossMargin] = useState(initialStats.grossMargin);
  const [netMargin, setNetMargin] = useState(initialStats.netMargin);
  const skipNextRecalc = useRef(false);

  // Filter entries by selected date range
  const filteredEntries = useMemo(() => {
    // Handle custom date range
    if (dateFilter === "customize" && customFromDate && customToDate) {
      return filterByCustomDateRange(entries, customFromDate, customToDate);
    }
    // Handle preset date ranges
    if (dateFilter !== "customize") {
      return filterByDateRange(entries, dateFilter as DateRange);
    }
    // If customize selected but dates not set, return all entries
    return entries;
  }, [entries, dateFilter, customFromDate, customToDate]);

  useEffect(() => {
    console.log("Profit Lens is now CLIENT — real-time will work");
  }, []);

  const recalcKpis = useCallback(
    (nextEntries: Entry[], nextFilters = filters) => {
      const nextStats = buildProfitStats(nextEntries);
      setSales(nextStats.sales);
      setCogs(nextStats.cogs);
      setOpex(nextStats.opex);
      setGrossProfit(nextStats.grossProfit);
      setNetProfit(nextStats.netProfit);
      setGrossMargin(nextStats.grossMargin);
      setNetMargin(nextStats.netMargin);
      return nextStats;
    },
    [], // CRITICAL: Empty deps - don't recreate on filter changes to prevent re-subscriptions
  );

  const refetchEntries = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("entries")
        .select(ENTRY_SELECT)
        .eq("user_id", userId)
        .order("entry_date", { ascending: false });

      if (error) {
        throw error;
      }

      const nextEntries = data?.map((entry) => normalizeEntry(entry)) ?? [];
      skipNextRecalc.current = true;
      setEntries(nextEntries);
      return nextEntries;
    } catch (error) {
      console.error("Failed to refetch entries for Profit Lens", error);
      return undefined;
    }
  }, [supabase, userId]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let retryAttempt = 0;
    let hasAlertedRealtimeFailure = false;
    let isMounted = true;

    console.info("[Realtime Load] Changes applied – backoff max 30s");

    const alertRealtimeFailure = () => {
      if (hasAlertedRealtimeFailure) return;
      hasAlertedRealtimeFailure = true;
      if (typeof window !== "undefined" && typeof window.alert === "function") {
        window.alert("Realtime failed – refresh");
      }
    };

    const logCloseReason = (
      event?: { code?: number; reason?: string },
      payload?: unknown,
    ) => {
      const code = event?.code ?? "unknown";
      const reason = (event?.reason ?? "none").trim() || "none";
      let payloadSummary: string;
      try {
        payloadSummary =
          payload === undefined
            ? "none"
            : JSON.stringify(payload, (_key, value) =>
                typeof value === "bigint" ? Number(value) : value,
              );
      } catch {
        payloadSummary = "unserializable";
      }
      console.warn(
        `[Realtime Closed] Code ${code}: ${reason} payload ${payloadSummary} (profit-lens channel)`,
      );
    };

    const teardownChannel = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const startHeartbeat = () => {
      if (heartbeatTimer || !channel) return;
      heartbeatTimer = setInterval(() => {
        channel?.send({
          type: "broadcast",
          event: "heartbeat",
          payload: {},
          topic: "heartbeat",
        } as any);
      }, 30000);
    };

    const subscribe = () => {
      teardownChannel();

      channel = supabase
        .channel(`public:entries:${userId}:profit`)
        .on("system", { event: "*" }, (systemPayload) => {
          console.log("[Realtime System]", systemPayload);
        })
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "entries",
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            console.log("REAL-TIME: payload received", payload);
            const latestEntries = await refetchEntries();
            if (!latestEntries) {
              return;
            }
            console.log("REAL-TIME: refetch complete – entries count:", latestEntries.length);
            // Filter entries by current date range before recalculating
            let filteredLatest: Entry[];
            if (dateFilter === "customize" && customFromDate && customToDate) {
              filteredLatest = filterByCustomDateRange(latestEntries, customFromDate, customToDate);
            } else if (dateFilter !== "customize") {
              filteredLatest = filterByDateRange(latestEntries, dateFilter as DateRange);
            } else {
              filteredLatest = latestEntries;
            }
            const updatedStats = recalcKpis(filteredLatest);
            console.log(
              "REAL-TIME: KPIs recalculated → net profit:",
              updatedStats.netProfit,
              "sales:",
              updatedStats.sales,
            );
          },
        )
        .subscribe(async (status) => {
          console.log(`[Realtime] Status: ${status}`);
          if (status === "SUBSCRIBED") {
            console.log("[Realtime] joined public:entries Profit Lens channel");
            retryAttempt = 0;
            hasAlertedRealtimeFailure = false;
            startHeartbeat();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            logCloseReason(undefined, { status });
            console.error("[Realtime Error] Closed – scheduling retry");
            teardownChannel();
            // Note: DO NOT call refreshSession() here - it causes 429 rate limiting
            // Middleware handles session refresh automatically
            scheduleRetry();
          }
        });

      const socket = (channel as unknown as { socket?: { onClose?: (cb: (event?: CloseEvent) => void) => void } })
        ?.socket;
      socket?.onClose?.((event?: CloseEvent) => logCloseReason(event, { source: "socket" }));
    };

    const scheduleRetry = () => {
      if (!isMounted || retryTimer) {
        return;
      }
      if (retryAttempt >= MAX_REALTIME_RECONNECT_ATTEMPTS) {
        console.error("[Realtime Error] Max retries reached for Profit Lens channel.");
        alertRealtimeFailure();
        return;
      }
      const attemptIndex = retryAttempt + 1;
      const exponentialDelay = BASE_REALTIME_DELAY_MS * 2 ** retryAttempt;
      const delay = Math.min(exponentialDelay, MAX_REALTIME_DELAY_MS);
      console.warn(
        `[Realtime Retry] attempt ${attemptIndex} in ${delay}ms (profit-lens channel)`,
      );
      retryTimer = setTimeout(() => {
        retryTimer = null;
        retryAttempt = attemptIndex;
        subscribe();
      }, delay);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Note: DO NOT call refreshSession() here - middleware handles it
        // Just reconnect the Realtime channel if needed
        if (!channel || channel.state !== "joined") {
          retryAttempt = 0;
          hasAlertedRealtimeFailure = false;
          subscribe();
        }
      }
    };

    subscribe();

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      isMounted = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      teardownChannel();
    };
  }, [recalcKpis, refetchEntries, supabase, userId]);

  useEffect(() => {
    if (skipNextRecalc.current) {
      skipNextRecalc.current = false;
      return;
    }
    recalcKpis(filteredEntries, filters);
  }, [filteredEntries, filters, recalcKpis]);

  // Dynamic date range label
  const dateRangeLabel = useMemo(() => {
    if (dateFilter === "customize" && customFromDate && customToDate) {
      return formatCustomDateLabel(customFromDate, customToDate);
    }
    if (dateFilter !== "customize") {
      return getDateRangeLabel(dateFilter as DateRange);
    }
    return "Select date range";
  }, [dateFilter, customFromDate, customToDate]);

  // Calculate total expenses (COGS + OPEX)
  const totalExpenses = useMemo(() => cogs + opex, [cogs, opex]);

  return (
      <div className="flex flex-col gap-4 text-white">
      {/* Page Header - Title and Date Filter on Same Line */}
      <div className="flex items-center justify-between mt-2 mb-3">
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          See what you earned
        </h1>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <label className="text-purple-300 text-sm hidden md:inline">Date:</label>
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setShowCustomDatePickers(e.target.value === "customize");
            }}
            className="px-3 py-2 bg-[#1a1a2e] border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
          >
            <option value="this-month">This Month</option>
            <option value="last-month">Last Month</option>
            <option value="this-year">This Year</option>
            <option value="last-year">Last Year</option>
            <option value="all-time">All Time</option>
            <option value="customize">Customize</option>
          </select>
        </div>
      </div>

      {/* Custom Date Pickers */}
      {showCustomDatePickers && (
        <div className="flex flex-wrap items-center gap-2 -mt-2 mb-2">
          <span className="text-sm text-muted-foreground">From:</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="px-3 py-2 border border-border bg-secondary rounded-lg text-sm text-white hover:bg-primary/80 focus:border-purple-500 focus:outline-none">
                {customFromDate ? format(customFromDate, "MMM dd, yyyy") : "Select date"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customFromDate}
                onSelect={setCustomFromDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <span className="text-sm text-muted-foreground">To:</span>
          <Popover>
            <PopoverTrigger asChild>
              <button className="px-3 py-2 border border-border bg-secondary rounded-lg text-sm text-white hover:bg-primary/80 focus:border-purple-500 focus:outline-none">
                {customToDate ? format(customToDate, "MMM dd, yyyy") : "Select date"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customToDate}
                onSelect={setCustomToDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Simplified 3-Line Profit Calculation */}
      <section className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 to-purple-800/40 p-6 md:p-8 shadow-2xl shadow-black/40">
        <div className="space-y-6">
          {/* Line 1: Sales */}
          <div className="border-b border-purple-500/30 pb-5">
            <p className="text-sm md:text-base uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3">
              Sales
            </p>
            <p className="text-4xl md:text-5xl font-bold text-white mb-2">
              {currencyFormatter.format(sales)}
            </p>
            <p className="text-base md:text-lg text-purple-200 font-medium">
              {formatAmountInWordsShort(sales)}
            </p>
          </div>

          {/* Line 2: Total Expenses (COGS + OPEX) */}
          <div className="border-b border-purple-500/30 pb-5">
            <p className="text-sm md:text-base uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3 flex items-center gap-2">
              <span className="text-xl">−</span> Total Expenses
            </p>
            <p className="text-4xl md:text-5xl font-bold text-white mb-2">
              {currencyFormatter.format(totalExpenses)}
            </p>
            <p className="text-base md:text-lg text-purple-200 font-medium">
              {formatAmountInWordsShort(totalExpenses)}
            </p>
            <p className="text-xs md:text-sm text-purple-400 mt-2">
              COGS: {currencyFormatter.format(cogs)} + OPEX: {currencyFormatter.format(opex)}
            </p>
          </div>

          {/* Line 3: Net Profit with Net Margin % */}
          <div className="bg-purple-900/30 rounded-xl p-5 md:p-6 border border-purple-400/40 shadow-[0_0_25px_rgba(167,139,250,0.3)]">
            <p className="text-sm md:text-base uppercase tracking-[0.2em] text-purple-300 font-semibold mb-3 flex items-center gap-2">
              <span className="text-xl">=</span> Net Profit
            </p>
            <div className="flex items-baseline gap-3 mb-2">
              <p className="text-5xl md:text-6xl font-bold text-white">
                {currencyFormatter.format(netProfit)}
              </p>
              <p className="text-2xl md:text-3xl font-semibold text-purple-300">
                ({percentageFormatter(netMargin)})
              </p>
            </div>
            <p className="text-lg md:text-xl text-purple-200 font-medium">
              {formatAmountInWordsShort(netProfit)}
            </p>
          </div>
        </div>
      </section>
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
};

function buildProfitStats(entries: Entry[]): ProfitStats {
  let sales = 0;
  let cogs = 0;
  let opex = 0;

  entries.forEach((entry) => {
    if (entry.entry_type === "Cash Inflow" && entry.category === "Sales") {
      sales += entry.amount;
    } else if (entry.entry_type === "Cash Outflow") {
      if (entry.category === "COGS") {
        cogs += entry.amount;
      } else if (entry.category === "Opex") {
        opex += entry.amount;
      }
    }
  });

  const grossProfit = sales - cogs;
  const netProfit = grossProfit - opex;
  const grossMargin = sales > 0 ? grossProfit / sales : 0;
  const netMargin = sales > 0 ? netProfit / sales : 0;

  return {
    sales,
    cogs,
    opex,
    grossProfit,
    netProfit,
    grossMargin,
    netMargin,
  };
}
