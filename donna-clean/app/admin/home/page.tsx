"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, UserX, Sparkles, Activity, RefreshCw, AlertTriangle, Eye, CheckCircle } from "lucide-react";

type Priority = "urgent" | "watch" | "good" | "none";

type ActionItem = {
  priority: Priority;
  username: string;
  action: string;
  reason: string;
};

type Stats = {
  total_users: number;
  active_this_week: number;
  never_started: number;
  ai_engaged: number;
};

type ApiResponse = {
  actions: ActionItem[];
  stats: Stats;
  generated_at: string;
  cached: boolean;
};

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 0, watch: 1, good: 2, none: 3 };

const priorityConfig: Record<Priority, {
  label: string;
  border: string;
  bg: string;
  badge: string;
  icon: React.ReactNode;
}> = {
  urgent: {
    label: "Urgent",
    border: "border-l-red-500",
    bg: "bg-red-950/20",
    badge: "bg-red-500/20 text-red-300",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  watch: {
    label: "Watch",
    border: "border-l-yellow-400",
    bg: "bg-yellow-950/20",
    badge: "bg-yellow-500/20 text-yellow-300",
    icon: <Eye className="w-3.5 h-3.5" />,
  },
  good: {
    label: "Good",
    border: "border-l-green-400",
    bg: "bg-green-950/20",
    badge: "bg-green-500/20 text-green-300",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  none: {
    label: "Low priority",
    border: "border-l-white/10",
    bg: "bg-white/5",
    badge: "bg-white/10 text-white/40",
    icon: null,
  },
};

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="p-5 border border-purple-500/30 rounded-xl bg-purple-900/10 flex items-center gap-4">
      <div className="p-2.5 rounded-lg bg-purple-500/20 shrink-0">{icon}</div>
      <div>
        <div className="text-xs text-white/50 mb-0.5">{label}</div>
        <div className="text-2xl font-bold text-white leading-none">{value}</div>
        {sub && <div className="text-xs text-white/40 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function ActionCard({ item }: { item: ActionItem }) {
  const cfg = priorityConfig[item.priority];
  return (
    <div className={`border-l-4 ${cfg.border} ${cfg.bg} rounded-r-xl p-4 space-y-1.5`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
          {cfg.icon}
          {cfg.label}
        </span>
        <span className="text-sm font-semibold text-white">{item.username}</span>
      </div>
      <p className="text-sm text-white/90 font-medium">{item.action}</p>
      <p className="text-xs text-white/50">{item.reason}</p>
    </div>
  );
}

export default function AdminHomePage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNone, setShowNone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActions = useCallback(async (refresh = false) => {
    try {
      const url = refresh
        ? "/api/admin/user-actions-ai?refresh=true"
        : "/api/admin/user-actions-ai";
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json: ApiResponse = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    fetchActions(false).finally(() => setLoading(false));
  }, [fetchActions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchActions(true);
    setRefreshing(false);
  };

  const sorted = data
    ? [...data.actions].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    : [];

  const visible = sorted.filter((a) => a.priority !== "none");
  const deprioritised = sorted.filter((a) => a.priority === "none");

  return (
    <div className="space-y-8">

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Admin Home</h2>
          {data && (
            <p className="text-xs text-white/40 mt-0.5">
              {data.cached ? "Cached" : "Live"} · generated{" "}
              {new Date(data.generated_at).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh AI"}
        </button>
      </div>

      {/* Aggregate stats */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5 text-purple-400" />}
            label="Total Users"
            value={data.stats.total_users}
          />
          <StatCard
            icon={<Activity className="w-5 h-5 text-green-400" />}
            label="Active This Week"
            value={data.stats.active_this_week}
            sub="entry in last 7 days"
          />
          <StatCard
            icon={<UserX className="w-5 h-5 text-red-400" />}
            label="Never Started"
            value={data.stats.never_started}
            sub="zero entries ever"
          />
          <StatCard
            icon={<Sparkles className="w-5 h-5 text-cyan-400" />}
            label="AI Engaged"
            value={data.stats.ai_engaged}
            sub="1+ AI chats"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 space-y-3">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
          <p className="text-white/50 text-sm">Asking Donna AI for your action list…</p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-sm">
          Error: {error}
        </div>
      )}

      {/* Action list */}
      {!loading && data && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">What to do today</h3>

          {visible.length === 0 ? (
            <p className="text-white/40 text-sm">No urgent or watch items — looking good.</p>
          ) : (
            <div className="space-y-3">
              {visible.map((item, i) => (
                <ActionCard key={`${item.username}-${i}`} item={item} />
              ))}
            </div>
          )}

          {/* Deprioritised / none */}
          {deprioritised.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowNone((v) => !v)}
                className="text-xs text-white/40 hover:text-white/60 underline underline-offset-2 transition-colors"
              >
                {showNone ? "Hide" : `Show ${deprioritised.length} deprioritised`}
              </button>
              {showNone && (
                <div className="mt-3 space-y-2">
                  {deprioritised.map((item, i) => (
                    <ActionCard key={`none-${item.username}-${i}`} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
