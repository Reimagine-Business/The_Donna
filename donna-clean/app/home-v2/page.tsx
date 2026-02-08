import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { BottomNavV2 } from "@/components/home-v2/bottom-nav-v2";
import { TopNavV2 } from "@/components/home-v2/top-nav-v2";
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
    <main className="min-h-screen bg-[#1e2A56] pb-24 md:pb-8">
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <TopNavV2 />

        <section className="flex-1 px-4 py-3 md:px-8 overflow-auto">
          <div className="mx-auto w-full max-w-2xl space-y-4">
            {/* Greeting */}
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {greeting}, {user.user_metadata?.name || user.email?.split("@")[0]}
              </h1>
              {profile?.business_name && (
                <p className="text-sm text-white/60 mt-0.5">
                  {profile.business_name}
                </p>
              )}
            </div>

            {/* Donna Says Card — Purple Gradient with overflowing avatar */}
            <div className="relative">
              <div className="relative rounded-2xl p-5 pr-28 sm:pr-36 overflow-visible">
                <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed] via-[#a855f7] to-[#c084fc] rounded-2xl" />

                <div className="relative">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white mb-2">
                        Donna says:
                      </h3>
                      <DonnaMessage
                        entries={entries}
                        reminders={reminders || []}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Avatar positioned to overflow the card on the right */}
              <div className="absolute -right-2 -top-4 sm:-right-1 sm:-top-3 z-10">
                <DonnaAvatarCompact />
              </div>
            </div>

            {/* Business Cards (What's Yours, Not Yours, Profit) */}
            <Suspense fallback={<EntryListSkeleton />}>
              <BusinessCards entries={entries} />
            </Suspense>
          </div>
        </section>
      </div>

      <BottomNavV2 />
    </main>
  );
}
