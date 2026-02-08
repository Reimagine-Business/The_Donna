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
    <main className="min-h-screen bg-background text-foreground pb-24 md:pb-8">
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <TopNavMobile />

        <section className="flex-1 px-4 py-3 md:px-8 overflow-auto">
          <div className="mx-auto w-full max-w-2xl space-y-4">
            {/* Greeting */}
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {greeting}
              </h1>
              {profile?.business_name && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {profile.business_name}
                </p>
              )}
            </div>

            {/* Donna Section — Message Left, Avatar Right (all screen sizes) */}
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/40 rounded-2xl border border-purple-500/30 p-4">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Left: Donna Says Message */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    <span className="text-lg sm:text-xl flex-shrink-0">💬</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm sm:text-base font-semibold text-white mb-1 sm:mb-2">
                        Donna says:
                      </h3>
                      <DonnaMessage
                        entries={entries}
                        reminders={reminders || []}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Donna Avatar — always visible */}
                <div className="flex-shrink-0">
                  <DonnaAvatarCompact />
                </div>
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
