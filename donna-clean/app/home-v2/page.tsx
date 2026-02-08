import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { TopNavMobile } from "@/components/navigation/top-nav-mobile";
import { DonnaAvatarCompact } from "@/components/home-v2/donna-avatar-compact";
import { DonnaMessage } from "@/components/home-v2/donna-message";
import { BusinessCards } from "@/components/home-v2/business-cards";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getEntries } from "@/app/entries/actions";
import { EntryListSkeleton } from "@/components/skeletons/entry-skeleton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomeV2Page() {
  const supabase = await createSupabaseServerClient();
  const { user, initialError } = await getOrRefreshUser(supabase);

  if (!user) {
    console.error(
      `[Auth Fail] No user in home-v2/page${
        initialError ? ` – error: ${initialError.message}` : ""
      }`,
      initialError ?? undefined
    );
    redirect("/auth/login");
  }

  // Fetch entries for dashboard (REUSE existing server action)
  const { entries } = await getEntries();

  // Fetch user profile for business name (REUSE existing query)
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // Fetch reminders for Donna's message (REUSE existing query)
  const { data: reminders } = await supabase
    .from("reminders")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("due_date", { ascending: true });

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="min-h-screen bg-[#0a0e1a] pb-24 md:pb-8">
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <TopNavMobile />

        <section className="flex-1 px-4 py-3 md:px-8 overflow-auto">
          <div className="mx-auto w-full max-w-2xl space-y-4">
            {/* Greeting */}
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {greeting}, {user.user_metadata?.name || user.email?.split("@")[0]}
              </h1>
              {profile?.business_name && (
                <p className="text-sm text-gray-400 mt-0.5">
                  {profile.business_name}
                </p>
              )}
            </div>

            {/* Donna Section — Purple Card with Speech Bubble */}
            <div className="relative rounded-2xl overflow-hidden border border-purple-500/30 shadow-lg shadow-purple-500/10">
              {/* Vibrant purple gradient background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed] via-[#9333ea] to-[#a855f7]" />
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/5" />

              {/* Top bar: "Donna says:" + Avatar */}
              <div className="relative flex items-center justify-between px-5 pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  <h3 className="text-base font-semibold text-white">
                    Donna says:
                  </h3>
                </div>
                <div className="flex-shrink-0">
                  <DonnaAvatarCompact />
                </div>
              </div>

              {/* Speech bubble: darker area for message */}
              <div className="relative mx-3 mb-4 rounded-xl bg-[#111827]/80 border border-white/10 p-4">
                <DonnaMessage
                  entries={entries}
                  reminders={reminders || []}
                />
              </div>
            </div>

            {/* Business Cards (What's Yours, Not Yours, Profit) */}
            <Suspense fallback={<EntryListSkeleton />}>
              <BusinessCards entries={entries} />
            </Suspense>
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
