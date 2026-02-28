import { requireAdmin } from "@/lib/admin/check-admin";
import { createClient } from "@supabase/supabase-js";
import { Users, FileText, MessageCircle, Sparkles, BarChart3 } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  await requireAdmin();

  // Use service role client for ALL admin queries (bypasses RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Total users
  const {
    data: { users: authUsers },
  } = await supabaseAdmin.auth.admin.listUsers();
  const totalUsers = authUsers?.length || 0;

  // Total entries (all users) — use admin client to bypass RLS
  const { count: totalEntries } = await supabaseAdmin
    .from("entries")
    .select("*", { count: "exact", head: true });

  // AI usage — chat requests + cost from ai_usage_logs
  let aiChatCount = 0;
  let totalCostINR = 0;
  try {
    const { count } = await supabaseAdmin
      .from("ai_usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("feature", "chat");
    aiChatCount = count || 0;

    // Try server-side SUM via RPC (see SQL below), fallback to capped fetch
    // SQL to create: CREATE OR REPLACE FUNCTION get_ai_total_cost()
    //   RETURNS numeric AS $$ SELECT COALESCE(SUM(cost_usd), 0) FROM ai_usage_logs; $$ LANGUAGE sql SECURITY DEFINER;
    let totalCostUSD = 0;
    try {
      const { data: rpcData } = await supabaseAdmin.rpc("get_ai_total_cost");
      if (typeof rpcData === "number") totalCostUSD = rpcData;
      else throw new Error("RPC not available");
    } catch {
      // Fallback: capped fetch + client-side sum
      const { data: costData } = await supabaseAdmin
        .from("ai_usage_logs")
        .select("cost_usd")
        .limit(10000);
      totalCostUSD =
        costData?.reduce((sum, row) => sum + (row.cost_usd || 0), 0) || 0;
    }
    totalCostINR = totalCostUSD * 83;
  } catch {
    // table may not exist yet
  }

  const avgEntriesPerUser =
    totalUsers > 0 ? Math.round((totalEntries || 0) / totalUsers) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          System administration for The Donna
        </p>
        <div className="mt-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
          <p className="text-sm text-white/80">
            Admin Access: alfred@thedonnaapp.co
          </p>
        </div>
      </div>

      {/* Stats — row 1: 3 cards, row 2: 2 cards */}
      <div className="space-y-4">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <div className="text-sm text-white/60">Total Users</div>
                <div className="text-3xl font-bold text-white">{totalUsers}</div>
              </div>
            </div>
          </div>

          <div className="p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <FileText className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <div className="text-sm text-white/60">Total Entries</div>
                <div className="text-3xl font-bold text-white">
                  {totalEntries || 0}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20">
                <MessageCircle className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <div className="text-sm text-white/60">AI Chat Requests</div>
                <div className="text-3xl font-bold text-white">
                  {aiChatCount}
                </div>
                <div className="text-xs text-white/40 mt-1">
                  Est. cost: ₹{totalCostINR.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-cyan-500/20">
                <MessageCircle className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <div className="text-sm text-white/60">Total AI Chats</div>
                <div className="text-3xl font-bold text-white">{aiChatCount}</div>
              </div>
            </div>
          </div>

          <div className="p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-500/20">
                <BarChart3 className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <div className="text-sm text-white/60">Avg Entries/User</div>
                <div className="text-3xl font-bold text-white">{avgEntriesPerUser}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Tools */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Admin Tools</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/admin/users/manage"
            className="p-6 border border-purple-500/30 rounded-xl bg-purple-900/10 hover:bg-purple-900/20 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">
                  User Management
                </h3>
                <p className="text-sm text-white/60">
                  View users, deactivate/reactivate accounts, reset passwords
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/admin/users/monitor"
            className="p-6 border border-purple-500/30 rounded-xl bg-purple-900/10 hover:bg-purple-900/20 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30">
                <Sparkles className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white mb-1">
                  User Monitoring
                </h3>
                <p className="text-sm text-white/60">
                  Track user activity, logins, entries, and engagement
                </p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
