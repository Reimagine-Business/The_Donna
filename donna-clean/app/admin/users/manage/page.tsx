import { requireAdmin } from "@/lib/admin/check-admin";
import { createClient } from "@supabase/supabase-js";
import { Users, UserPlus } from "lucide-react";
import Link from "next/link";
import { CreateUserDirect } from "@/components/admin/create-user-direct";
import { UserActionsPanel } from "@/components/admin/user-actions-panel";

export default async function UserManagementPage() {
  await requireAdmin();

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Fetch all users via admin API
  const {
    data: { users: authUsers },
  } = await supabaseAdmin.auth.admin.listUsers();

  // Fetch all profiles (for username)
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, username");

  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  const userList = (authUsers || []).map((u) => {
    const profile = profileMap.get(u.id);
    return {
      id: u.id,
      email: u.email || "No email",
      username:
        profile?.username ||
        u.user_metadata?.username ||
        u.email?.split("@")[0] ||
        "Unknown",
      banned_until:
        (u as unknown as { banned_until?: string }).banned_until || null,
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="text-white/60">
            View, create, and manage user accounts
          </p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>

      {/* All Users Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <Users className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              All Users ({userList.length})
            </h2>
            <p className="text-sm text-white/60">
              Deactivate, reactivate, or reset passwords
            </p>
          </div>
        </div>

        <UserActionsPanel users={userList} />
      </div>

      {/* Create User Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/20">
            <UserPlus className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              Create New User
            </h2>
            <p className="text-sm text-white/60">
              Create a user account directly with a temporary password
            </p>
          </div>
        </div>

        <div className="p-6 border border-purple-500/30 rounded-xl bg-purple-900/10">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg mb-4">
            <p className="text-sm text-white/80">
              Creates account instantly. Users can login immediately and change
              their password. Standard user access (no admin privileges).
            </p>
          </div>
          <CreateUserDirect />
        </div>
      </div>
    </div>
  );
}
