import { requireAdmin } from "@/lib/admin/check-admin";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { Users, FileText, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const supabase = await createSupabaseServerClient();

  // Total users
  const {
    data: { users: authUsers },
  } = await supabaseAdmin.auth.admin.listUsers();
  const totalUsers = authUsers?.length || 0;

  // Total entries (all users)
  const { count: totalEntries } = await supabase
    .from("entries")
    .select("*", { count: "exact", head: true });

  // AI usage — count from ai_usage_logs if it exists, otherwise show 0
  let aiInsightsCount = 0;
  try {
    const { count } = await supabase
      .from("ai_usage_logs")
      .select("*", { count: "exact", head: true });
    aiInsightsCount = count || 0;
  } catch {
    // table may not exist yet
  }

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
            Admin Access: reimaginebusiness2025@gmail.com
          </p>
        </div>
      </div>

      {/* Stats */}
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
              <Sparkles className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <div className="text-sm text-white/60">AI Insights Generated</div>
              <div className="text-3xl font-bold text-white">
                {aiInsightsCount}
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
