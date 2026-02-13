import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { BottomNavV2 } from "@/components/home-v2/bottom-nav-v2";
import { TopNavV2 } from "@/components/home-v2/top-nav-v2";
import { DonnaAvatarLarge } from "@/components/home-v2/donna-avatar-large";
import { DonnaMessageBullets } from "@/components/home-v2/donna-message-bullets";
import { BusinessCards } from "@/components/home-v2/business-cards";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getEntries } from "@/app/entries/actions";
import { EntryListSkeleton } from "@/components/skeletons/entry-skeleton";
import { DonnaChatWidget } from "@/components/home-v2/donna-chat-widget";

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
    .select("business_name, username")
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

  // Current date for display
  const currentDate = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-screen bg-[#0a0e1a] pb-24 md:pb-8">
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <TopNavV2 />

        <section className="flex-1 px-4 py-3 md:px-8 overflow-auto">
          <div className="mx-auto w-full max-w-2xl space-y-4">
            {/* Header: Greeting left, Avatar right */}
            <div className="flex items-start justify-between pt-2 pb-1 relative z-10">
              {/* Greeting text */}
              <div className="flex-1 pr-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {greeting},<br />
                  <span className="text-purple-300">
                    {profile?.username || "there"}!
                  </span>
                </h1>
                <p className="text-white/40 text-xs mt-1">
                  {currentDate}
                </p>
              </div>

              {/* Avatar - smaller, top right */}
              <div className="flex-shrink-0 relative z-20 translate-y-6">
                <DonnaAvatarLarge />
              </div>
            </div>

            {/* Donna says card - speech bubble feel */}
            <div className="rounded-2xl rounded-tr-sm bg-gradient-to-br from-purple-900/80 to-purple-950/90 border border-purple-500/30 shadow-lg shadow-purple-900/30 p-4 relative z-10">
              <p className="text-white font-bold text-base mb-3">
                Donna says:
              </p>

              {/* Bullets with avatar clearance */}
              <div className="pr-0 pt-8">
                <div className="space-y-3 text-white">
                  <DonnaMessageBullets
                    entries={entries}
                    reminders={reminders || []}
                  />
                </div>
              </div>
            </div>

            {/* Business Cards */}
            <Suspense fallback={<EntryListSkeleton />}>
              <BusinessCards entries={entries} />
            </Suspense>
          </div>
        </section>
      </div>

      <BottomNavV2 />
      <DonnaChatWidget />
    </main>
  );
}
