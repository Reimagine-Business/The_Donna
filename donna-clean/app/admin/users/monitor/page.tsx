import { requireAdmin } from "@/lib/admin/check-admin";
import { createClient } from "@supabase/supabase-js";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function UserMonitoringPage() {
  await requireAdmin();

  // Use service role client for ALL admin queries (bypasses RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get all users via admin API
  const {
    data: { users: authUsers },
  } = await supabaseAdmin.auth.admin.listUsers();

  // Get all profiles (for username + business_name)
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, username, business_name");

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  // Get entry counts per user — use admin client to bypass RLS
  const { data: entries } = await supabaseAdmin
    .from("entries")
    .select("user_id, created_at");

  // Count entries per user
  const entryCounts: Record<string, number> = {};
  const lastEntryDates: Record<string, string> = {};

  entries?.forEach((entry) => {
    entryCounts[entry.user_id] = (entryCounts[entry.user_id] || 0) + 1;
    if (
      !lastEntryDates[entry.user_id] ||
      entry.created_at > lastEntryDates[entry.user_id]
    ) {
      lastEntryDates[entry.user_id] = entry.created_at;
    }
  });

  // Combine data
  const usersWithStats =
    authUsers?.map((user) => {
      const profile = profileMap.get(user.id);
      return {
        id: user.id,
        email: user.email,
        username:
          profile?.username ||
          user.user_metadata?.username ||
          user.email?.split("@")[0] ||
          "Unknown",
        businessName: profile?.business_name || null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        role: user.app_metadata?.role || "user",
        entryCount: entryCounts[user.id] || 0,
        lastEntryDate: lastEntryDates[user.id],
      };
    }) || [];

  // Calculate stats
  const totalUsers = usersWithStats.length;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const activeUsers = usersWithStats.filter(
    (u) => u.last_sign_in_at && new Date(u.last_sign_in_at) > sevenDaysAgo
  ).length;

  const totalEntries = Object.values(entryCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">User Monitoring</h1>
          <p className="text-white/60">Track user activity and engagement</p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:gap-6 grid-cols-3">
        <div className="p-4 md:p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="p-2 md:p-3 rounded-lg bg-blue-500/20">
              <Activity className="h-5 w-5 md:h-6 md:w-6 text-blue-400" />
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
                Active (7d)
              </div>
              <div className="text-xl md:text-3xl font-bold text-white">
                {activeUsers}
              </div>
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
                  Last Login
                </th>
                <th className="text-left p-4 font-medium text-sm text-white/70">
                  Last Entry
                </th>
                <th className="text-right p-4 font-medium text-sm text-white/70">
                  Entries
                </th>
                <th className="text-center p-4 font-medium text-sm text-white/70">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {usersWithStats.map((user) => {
                const daysSinceLogin = user.last_sign_in_at
                  ? Math.floor(
                      (Date.now() -
                        new Date(user.last_sign_in_at).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : null;

                const isActive =
                  daysSinceLogin !== null && daysSinceLogin < 7;
                const isInactive =
                  daysSinceLogin !== null && daysSinceLogin > 30;

                return (
                  <tr
                    key={user.id}
                    className="border-t border-purple-500/20 hover:bg-purple-900/10"
                  >
                    {/* Username */}
                    <td className="p-4">
                      <div className="text-sm font-medium text-white">
                        {user.username}
                      </div>
                      {user.role === "admin" && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                          Admin
                        </span>
                      )}
                      {user.businessName && (
                        <div className="text-xs text-white/40">
                          {user.businessName}
                        </div>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="p-4 text-sm">
                      {user.last_sign_in_at ? (
                        <div>
                          <div className="text-white/80">
                            {format(
                              new Date(user.last_sign_in_at),
                              "MMM dd, HH:mm"
                            )}
                          </div>
                          <div className="text-xs text-white/40">
                            {formatDistanceToNow(
                              new Date(user.last_sign_in_at),
                              { addSuffix: true }
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-white/40">Never</span>
                      )}
                    </td>

                    {/* Last Entry */}
                    <td className="p-4 text-sm">
                      {user.lastEntryDate ? (
                        <div>
                          <div className="text-white/80">
                            {format(new Date(user.lastEntryDate), "MMM dd")}
                          </div>
                          <div className="text-xs text-white/40">
                            {formatDistanceToNow(
                              new Date(user.lastEntryDate),
                              { addSuffix: true }
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-white/40">No entries</span>
                      )}
                    </td>

                    {/* Entry Count */}
                    <td className="p-4 text-right">
                      <span className="font-semibold text-lg text-white">
                        {user.entryCount}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-4 text-center">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                          <Activity className="h-3 w-3" />
                          Active
                        </span>
                      ) : isInactive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertCircle className="h-3 w-3" />
                          Inactive
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          Moderate
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {usersWithStats.map((user) => {
          const daysSinceLogin = user.last_sign_in_at
            ? Math.floor(
                (Date.now() - new Date(user.last_sign_in_at).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null;
          const isActive = daysSinceLogin !== null && daysSinceLogin < 7;
          const isInactive = daysSinceLogin !== null && daysSinceLogin > 30;

          return (
            <div
              key={user.id}
              className="border border-purple-500/20 rounded-xl bg-purple-900/10 p-4"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-medium text-white">{user.username}</p>
                  {user.businessName && (
                    <p className="text-xs text-white/40">{user.businessName}</p>
                  )}
                </div>
                {isActive ? (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    Active
                  </span>
                ) : isInactive ? (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    Inactive
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    Moderate
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-white/50">Last Login</p>
                  <p className="text-white">
                    {user.last_sign_in_at
                      ? formatDistanceToNow(new Date(user.last_sign_in_at), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">Last Entry</p>
                  <p className="text-white">
                    {user.lastEntryDate
                      ? formatDistanceToNow(new Date(user.lastEntryDate), {
                          addSuffix: true,
                        })
                      : "None"}
                  </p>
                </div>
                <div>
                  <p className="text-white/50">Entries</p>
                  <p className="text-white font-bold">{user.entryCount}</p>
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
              <strong className="text-white">Active:</strong> Logged in within 7
              days
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-white/70">
              <strong className="text-white">Moderate:</strong> 7-30 days since
              login
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-white/70">
              <strong className="text-white">Inactive:</strong> Over 30 days
              since login
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
