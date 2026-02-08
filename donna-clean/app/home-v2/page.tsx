import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { BottomNavV2 } from "@/components/home-v2/bottom-nav-v2";
import { TopNavV2 } from "@/components/home-v2/top-nav-v2";
import Image from "next/image";
import { DonnaAvatarLarge } from "@/components/home-v2/donna-avatar-large";
import { DonnaMessageBullets } from "@/components/home-v2/donna-message-bullets";
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
        <TopNavV2 />

        <section className="flex-1 px-4 py-3 md:px-8 overflow-auto">
          <div className="mx-auto w-full max-w-2xl space-y-6">
            {/* Greeting — LEFT aligned */}
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {greeting}, {user.user_metadata?.name || user.email?.split("@")[0]}
              </h1>
              <p className="text-sm text-white/50">
                {profile?.business_name || "Reimagine Business"}
              </p>
            </div>

            {/* Donna Section — Avatar overlapping from right */}
            <div className="relative">
              {/* Message Box */}
              <div
                className="bg-purple-900/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30 pr-6 md:pr-40"
              >
                <h3 className="text-xl font-bold text-white mb-4">Donna says:</h3>

                <div className="space-y-3 text-white text-sm md:text-base">
                  <DonnaMessageBullets
                    entries={entries}
                    reminders={reminders || []}
                  />
                </div>
              </div>

              {/* Donna Avatar — Desktop: Large, overlapping from right */}
              <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                <DonnaAvatarLarge />
              </div>

              {/* Donna Avatar — Mobile: Small avatar in top-right corner */}
              <div className="md:hidden absolute top-4 right-4 z-10">
                <div
                  className="w-20 h-20 rounded-full p-[2px]"
                  style={{
                    background: "linear-gradient(135deg, #fbbf24, #f59e0b, #ec4899, #a855f7)",
                    boxShadow: "0 0 16px 4px rgba(251,191,36,0.25)",
                  }}
                >
                  <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
                    <Image
                      src="/images/donna/donna-avatar.png"
                      alt="Donna"
                      width={80}
                      height={80}
                      className="object-cover w-full h-full"
                      priority
                    />
                  </div>
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
    </main>
  );
}
