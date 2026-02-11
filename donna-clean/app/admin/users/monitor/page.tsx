import { requireAdmin } from "@/lib/admin/check-admin";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";

export default async function UserMonitoringPage() {
  await requireAdmin();

  // Admin client for auth operations (needs service role)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Regular client for data queries
  const supabase = await createSupabaseServerClient();

  // Get all users via admin API
  const {
    data: { users: authUsers },
  } = await supabaseAdmin.auth.admin.listUsers();

  // Get entry counts per user
  const { data: entries } = await supabase
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
    authUsers?.map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      role: user.app_metadata?.role || "user",
      entryCount: entryCounts[user.id] || 0,
      lastEntryDate: lastEntryDates[user.id],
    })) || [];

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

      {/* Users Table */}
      <div className="border border-purple-500/30 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-900/20">
              <tr>
                <th className="text-left p-3 md:p-4 font-medium text-xs md:text-sm text-white/70">
                  Email
                </th>
                <th className="text-left p-3 md:p-4 font-medium text-xs md:text-sm text-white/70">
                  Last Login
                </th>
                <th className="text-left p-3 md:p-4 font-medium text-xs md:text-sm text-white/70 hidden md:table-cell">
                  Last Entry
                </th>
                <th className="text-right p-3 md:p-4 font-medium text-xs md:text-sm text-white/70">
                  Entries
                </th>
                <th className="text-center p-3 md:p-4 font-medium text-xs md:text-sm text-white/70">
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
                    {/* Email */}
                    <td className="p-3 md:p-4">
                      <div className="text-xs md:text-sm font-medium text-white truncate max-w-[120px] md:max-w-none">
                        {user.email}
                      </div>
                      {user.role === "admin" && (
                        <span className="text-[10px] md:text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                          Admin
                        </span>
                      )}
                    </td>

                    {/* Last Login */}
                    <td className="p-3 md:p-4 text-xs md:text-sm">
                      {user.last_sign_in_at ? (
                        <div>
                          <div className="text-white/80">
                            {format(
                              new Date(user.last_sign_in_at),
                              "MMM dd, HH:mm"
                            )}
                          </div>
                          <div className="text-[10px] md:text-xs text-white/40">
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

                    {/* Last Entry - hidden on mobile */}
                    <td className="p-3 md:p-4 text-xs md:text-sm hidden md:table-cell">
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
                    <td className="p-3 md:p-4 text-right">
                      <span className="font-semibold text-base md:text-lg text-white">
                        {user.entryCount}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-3 md:p-4 text-center">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                          <Activity className="h-3 w-3 hidden md:inline" />
                          Active
                        </span>
                      ) : isInactive ? (
                        <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertCircle className="h-3 w-3 hidden md:inline" />
                          Inactive
                        </span>
                      ) : (
                        <span className="px-1.5 md:px-2 py-0.5 md:py-1 text-[10px] md:text-xs rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
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

      {/* Activity Legend */}
      <div className="p-4 border border-purple-500/30 rounded-xl bg-purple-900/10">
        <h3 className="font-semibold mb-3 text-white">Activity Status</h3>
        <div className="grid gap-2 md:grid-cols-3 text-xs md:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-white/70">
              <strong className="text-white">Active:</strong> Logged in within
              7 days
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
