import { requireAdmin } from "@/lib/admin/check-admin";
import { createClient } from "@supabase/supabase-js";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Clock,
  AlertCircle,
  MessageCircle,
  Users as UsersIcon,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { UserRowExpander } from "@/components/admin/user-row-expander";

type EnhancedUserStat = {
  user_id: string;
  username: string;
  business_name: string | null;
  role: string;
  created_at: string;
  last_sign_in: string | null;
  total_entries: number;
  cash_in_count: number;
  cash_out_count: number;
  credit_count: number;
  advance_count: number;
  last_entry_date: string | null;
  total_settlements: number;
  total_parties: number;
  total_ai_chats: number;
  last_ai_chat: string | null;
  active_days_30d: number;
};

function formatDaysSince(dateStr: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year" : `${years} years`;
}

function ActiveDaysBadge({ days }: { days: number }) {
  let colorClass: string;
  if (days >= 15) {
    colorClass = "text-green-400 bg-green-500/10 border-green-500/20";
  } else if (days >= 5) {
    colorClass = "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
  } else {
    colorClass = "text-red-400 bg-red-500/10 border-red-500/20";
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${colorClass}`}
    >
      {days}/30
    </span>
  );
}

function StatusBadge({ lastEntryDate }: { lastEntryDate: string | null }) {
  const daysSinceEntry = lastEntryDate
    ? Math.floor(
        (Date.now() - new Date(lastEntryDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;
  const isActive = daysSinceEntry !== null && daysSinceEntry < 7;
  const isInactive = daysSinceEntry === null || daysSinceEntry > 30;

  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
        <Activity className="h-3 w-3" />
        Active
      </span>
    );
  }
  if (isInactive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
        <AlertCircle className="h-3 w-3" />
        Inactive
      </span>
    );
  }
  return (
    <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
      Moderate
    </span>
  );
}

export default async function UserMonitoringPage() {
  await requireAdmin();

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // ---------- Fetch enhanced stats (RPC with fallback) ----------
  let usersWithStats: EnhancedUserStat[] = [];

  try {
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      "get_enhanced_user_stats"
    );
    if (rpcError) throw rpcError;
    if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
      usersWithStats = rpcData.map((row: Record<string, unknown>) => ({
        user_id: row.user_id as string,
        username: (row.username as string) || "Unknown",
        business_name: (row.business_name as string) || null,
        role: (row.role as string) || "user",
        created_at: row.created_at as string,
        last_sign_in: (row.last_sign_in as string) || null,
        total_entries: Number(row.total_entries) || 0,
        cash_in_count: Number(row.cash_in_count) || 0,
        cash_out_count: Number(row.cash_out_count) || 0,
        credit_count: Number(row.credit_count) || 0,
        advance_count: Number(row.advance_count) || 0,
        last_entry_date: (row.last_entry_date as string) || null,
        total_settlements: Number(row.total_settlements) || 0,
        total_parties: Number(row.total_parties) || 0,
        total_ai_chats: Number(row.total_ai_chats) || 0,
        last_ai_chat: (row.last_ai_chat as string) || null,
        active_days_30d: Number(row.active_days_30d) || 0,
      }));
    } else {
      throw new Error("RPC returned empty");
    }
  } catch {
    // ---- Fallback: manual queries ----
    const {
      data: { users: authUsers },
    } = await supabaseAdmin.auth.admin.listUsers();

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, username, business_name, role");

    const profileMap = new Map(
      (profiles || []).map((p: { user_id: string; username: string; business_name: string | null; role: string }) => [
        p.user_id,
        p,
      ])
    );

    // Entry counts per user by type
    const { data: entries } = await supabaseAdmin
      .from("entries")
      .select("user_id, entry_type, created_at")
      .order("created_at", { ascending: false })
      .limit(50000);

    const entryStats: Record<
      string,
      {
        total: number;
        cashIn: number;
        cashOut: number;
        credit: number;
        advance: number;
        lastDate: string | null;
        activeDays30d: Set<string>;
      }
    > = {};

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    (entries || []).forEach(
      (e: { user_id: string; entry_type: string; created_at: string }) => {
        if (!entryStats[e.user_id]) {
          entryStats[e.user_id] = {
            total: 0,
            cashIn: 0,
            cashOut: 0,
            credit: 0,
            advance: 0,
            lastDate: null,
            activeDays30d: new Set(),
          };
        }
        const s = entryStats[e.user_id];
        s.total++;
        if (e.entry_type === "Cash IN") s.cashIn++;
        else if (e.entry_type === "Cash OUT") s.cashOut++;
        else if (e.entry_type === "Credit") s.credit++;
        else if (e.entry_type === "Advance") s.advance++;

        if (!s.lastDate || e.created_at > s.lastDate) s.lastDate = e.created_at;

        if (new Date(e.created_at) >= thirtyDaysAgo) {
          s.activeDays30d.add(e.created_at.slice(0, 10));
        }
      }
    );

    // Party counts
    const partyCounts: Record<string, number> = {};
    try {
      const { data: parties } = await supabaseAdmin
        .from("parties")
        .select("user_id")
        .limit(50000);
      (parties || []).forEach((p: { user_id: string }) => {
        partyCounts[p.user_id] = (partyCounts[p.user_id] || 0) + 1;
      });
    } catch {
      // table may not exist
    }

    // Settlement counts
    const settlementCounts: Record<string, number> = {};
    try {
      const { data: settlements } = await supabaseAdmin
        .from("settlement_history")
        .select("user_id")
        .limit(50000);
      (settlements || []).forEach((s: { user_id: string }) => {
        settlementCounts[s.user_id] = (settlementCounts[s.user_id] || 0) + 1;
      });
    } catch {
      // table may not exist
    }

    // AI chat counts
    const aiCounts: Record<string, { total: number; lastChat: string | null }> =
      {};
    try {
      const { data: aiLogs } = await supabaseAdmin
        .from("ai_usage_logs")
        .select("user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(50000);
      (aiLogs || []).forEach((a: { user_id: string; created_at: string }) => {
        if (!aiCounts[a.user_id]) {
          aiCounts[a.user_id] = { total: 0, lastChat: null };
        }
        aiCounts[a.user_id].total++;
        if (
          !aiCounts[a.user_id].lastChat ||
          a.created_at > aiCounts[a.user_id].lastChat!
        ) {
          aiCounts[a.user_id].lastChat = a.created_at;
        }
      });
    } catch {
      // table may not exist
    }

    usersWithStats = (authUsers || []).map((user) => {
      const profile = profileMap.get(user.id);
      const es = entryStats[user.id];
      return {
        user_id: user.id,
        username:
          profile?.username ||
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          "Unknown",
        business_name: profile?.business_name || null,
        role: profile?.role || user.app_metadata?.role || "user",
        created_at: user.created_at,
        last_sign_in: user.last_sign_in_at || null,
        total_entries: es?.total || 0,
        cash_in_count: es?.cashIn || 0,
        cash_out_count: es?.cashOut || 0,
        credit_count: es?.credit || 0,
        advance_count: es?.advance || 0,
        last_entry_date: es?.lastDate || null,
        total_settlements: settlementCounts[user.id] || 0,
        total_parties: partyCounts[user.id] || 0,
        total_ai_chats: aiCounts[user.id]?.total || 0,
        last_ai_chat: aiCounts[user.id]?.lastChat || null,
        active_days_30d: es?.activeDays30d.size || 0,
      };
    });

    // Sort by last sign in desc
    usersWithStats.sort((a, b) => {
      if (!a.last_sign_in && !b.last_sign_in) return 0;
      if (!a.last_sign_in) return 1;
      if (!b.last_sign_in) return -1;
      return (
        new Date(b.last_sign_in).getTime() -
        new Date(a.last_sign_in).getTime()
      );
    });
  }

  // ---------- Aggregate summary stats ----------
  const totalUsers = usersWithStats.length;
  const totalEntries = usersWithStats.reduce(
    (sum, u) => sum + u.total_entries,
    0
  );
  const totalAiChats = usersWithStats.reduce(
    (sum, u) => sum + u.total_ai_chats,
    0
  );
  const avgEntriesPerUser =
    totalUsers > 0 ? Math.round(totalEntries / totalUsers) : 0;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const activeUsers = usersWithStats.filter((u) => {
    if (!u.last_entry_date) return false;
    return new Date(u.last_entry_date) >= sevenDaysAgo;
  }).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">User Monitoring</h1>
          <p className="text-white/60">
            Track user activity, engagement, and behavior metrics
          </p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Stats Overview — row 1: 3 cards, row 2: 2 cards */}
      <div className="space-y-4">
        <div className="grid gap-4 md:gap-6 grid-cols-3">
          <div className="p-4 md:p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-lg bg-blue-500/20">
                <UsersIcon className="h-5 w-5 md:h-6 md:w-6 text-[#8b5cf6]" />
              </div>
              <div>
                <div className="text-[10px] md:text-sm text-white/60">
                  Total Users
                </div>
                <div className="text-xl md:text-3xl font-bold text-white">
                  {totalUsers}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-lg bg-green-500/20">
                <Clock className="h-5 w-5 md:h-6 md:w-6 text-green-400" />
              </div>
              <div>
                <div className="text-[10px] md:text-sm text-white/60">
                  Active Users
                </div>
                <div className="text-xl md:text-3xl font-bold text-white">
                  {activeUsers}
                </div>
                <div className="text-[10px] text-white/40">last 7 days</div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-lg bg-purple-500/20">
                <Activity className="h-5 w-5 md:h-6 md:w-6 text-purple-400" />
              </div>
              <div>
                <div className="text-[10px] md:text-sm text-white/60">
                  Total Entries
                </div>
                <div className="text-xl md:text-3xl font-bold text-white">
                  {totalEntries}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 grid-cols-2">
          <div className="p-4 md:p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-lg bg-cyan-500/20">
                <MessageCircle className="h-5 w-5 md:h-6 md:w-6 text-cyan-400" />
              </div>
              <div>
                <div className="text-[10px] md:text-sm text-white/60">
                  Total AI Chats
                </div>
                <div className="text-xl md:text-3xl font-bold text-white">
                  {totalAiChats}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 rounded-lg bg-amber-500/20">
                <BarChart3 className="h-5 w-5 md:h-6 md:w-6 text-amber-400" />
              </div>
              <div>
                <div className="text-[10px] md:text-sm text-white/60">
                  Avg Entries/User
                </div>
                <div className="text-xl md:text-3xl font-bold text-white">
                  {avgEntriesPerUser}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="border border-purple-500/30 rounded-xl overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-900/20">
              <tr>
                <th className="text-left p-4 font-medium text-sm text-white/70">
                  Username
                </th>
                <th className="text-left p-4 font-medium text-sm text-white/70">
                  Since Signup
                </th>
                <th className="text-left p-4 font-medium text-sm text-white/70">
                  Last Login
                </th>
                <th className="text-right p-4 font-medium text-sm text-white/70">
                  Entries
                </th>
                <th className="text-center p-4 font-medium text-sm text-white/70">
                  Active Days
                </th>
                <th className="text-center p-4 font-medium text-sm text-white/70">
                  Status
                </th>
                <th className="w-10 p-4"></th>
              </tr>
            </thead>
            <tbody>
              {usersWithStats.map((user) => (
                <UserRowExpander key={user.user_id} user={user} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {usersWithStats.map((user) => {
          const recentAiChat =
            user.last_ai_chat &&
            new Date(user.last_ai_chat) >=
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          return (
            <div
              key={user.user_id}
              className="border border-purple-500/20 rounded-xl bg-purple-900/10 p-4 space-y-3"
            >
              {/* Top: name + status */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-white">{user.username}</p>
                  {user.business_name && (
                    <p className="text-xs text-white/40">
                      {user.business_name}
                    </p>
                  )}
                  {user.role === "admin" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                      Admin
                    </span>
                  )}
                </div>
                <StatusBadge lastEntryDate={user.last_entry_date} />
              </div>

              {/* Row 1: login, last entry, entries */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-white/50">Last Login</p>
                  <p className="text-white">
                    {user.last_sign_in
                      ? formatDistanceToNow(new Date(user.last_sign_in), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">Signup</p>
                  <p className="text-white">
                    {formatDaysSince(user.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">Active Days</p>
                  <p className="text-white">
                    <ActiveDaysBadge days={user.active_days_30d} />
                  </p>
                </div>
              </div>

              {/* Row 2: entry breakdown */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div>
                  <p className="text-white/50">Cash IN</p>
                  <p className="text-green-400 font-medium">
                    {user.cash_in_count || "\u2014"}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">Cash OUT</p>
                  <p className="text-red-400 font-medium">
                    {user.cash_out_count || "\u2014"}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">Credit</p>
                  <p className="text-amber-400 font-medium">
                    {user.credit_count || "\u2014"}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">Advance</p>
                  <p className="text-blue-400 font-medium">
                    {user.advance_count || "\u2014"}
                  </p>
                </div>
              </div>

              {/* Row 3: settlements, parties, AI */}
              <div className="grid grid-cols-3 gap-2 text-xs border-t border-purple-500/10 pt-2">
                <div>
                  <p className="text-white/50">Settlements</p>
                  <p className="text-white font-medium">
                    {user.total_settlements || "\u2014"}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">Parties</p>
                  <p className="text-white font-medium">
                    {user.total_parties || "\u2014"}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">AI Chats</p>
                  <p className="text-white font-medium">
                    {user.total_ai_chats || "\u2014"}
                    {recentAiChat && (
                      <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Activity Legend */}
      <div className="p-4 border border-purple-500/30 rounded-xl bg-purple-900/10">
        <h3 className="font-semibold mb-3 text-white">Activity Status</h3>
        <div className="grid gap-2 md:grid-cols-3 text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-white/70">
              <strong className="text-white">Active:</strong> Made an entry
              within 7 days
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-white/70">
              <strong className="text-white">Moderate:</strong> Last entry 7-30
              days ago
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-white/70">
              <strong className="text-white">Inactive:</strong> No entry for 30+
              days
            </span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-purple-500/10">
          <h4 className="font-medium mb-2 text-white text-sm">
            Active Days (30d)
          </h4>
          <div className="grid gap-2 md:grid-cols-3 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-white/70">
                <strong className="text-white">15+:</strong> Highly engaged
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span className="text-white/70">
                <strong className="text-white">5-14:</strong> Moderate usage
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-white/70">
                <strong className="text-white">0-4:</strong> Low engagement
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
