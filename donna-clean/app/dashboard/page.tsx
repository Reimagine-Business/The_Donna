import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { TopNavMobile } from "@/components/navigation/top-nav-mobile";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic'

type Profile = {
  business_name: string | null;
  role: string | null;
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { user, initialError } = await getOrRefreshUser(supabase);

  if (!user) {
    console.error(
      `[Auth Fail] No user in dashboard/page${
        initialError ? ` – error: ${initialError.message}` : ""
      }`,
      initialError ?? undefined,
    );
    redirect("/auth/login");
  }

  // Best-effort server-side profile fetch.
  // If it fails (e.g. cookies not yet established after login redirect),
  // the client component will retry with fresh browser cookies.
  let serverProfile: Profile | null = null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("business_name, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error || error.code === "PGRST116") {
      serverProfile = data;
    }
  } catch {
    // Swallow — client component will handle the retry
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex flex-col">
        {/* Mobile Header */}
        <TopNavMobile />

        {/* Desktop Header */}
        <div className="hidden md:block">
          <SiteHeader />
        </div>

        {/* Main Content */}
        <section className="px-4 pb-24 pt-6 md:px-8 md:pb-8">
          <div className="mx-auto w-full max-w-4xl space-y-8">
            <DashboardContent
              serverProfile={serverProfile}
              userEmail={user.email ?? null}
              userId={user.id}
            />
          </div>
        </section>

        {/* Bottom Navigation */}
        <BottomNav />
      </div>
    </main>
  );
}
