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
import { getAllEntries } from "@/app/entries/actions";
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

  // Fetch all entries for dashboard (needs complete data for calculations)
  const { entries } = await getAllEntries();

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
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] text-white pb-24 md:pb-8">
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <TopNavV2 />

        <section className="flex-1 px-4 py-3 md:px-8 overflow-auto">
          <div className="mx-auto w-full max-w-2xl space-y-4">
            {/* Header: Greeting left, Avatar right */}
            <div className="flex items-start justify-between pt-2 pb-1 relative z-10">
              {/* Greeting text */}
              <div className="flex-1 pr-4">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  {greeting},<br />
                  <span className="text-[#c084fc] font-extrabold">
                    {profile?.username || "there"}!
                  </span>
                </h1>
                <p className="text-[#94a3b8] text-xs font-normal mt-1">
                  {currentDate}
                </p>
              </div>

              {/* Avatar - smaller, top right, overlaps purple card */}
              <div className="flex-shrink-0 relative z-20 translate-y-4">
                <DonnaAvatarLarge />
              </div>
            </div>

            {/* Donna says card - glassmorphism */}
            <div
              className="rounded-2xl rounded-tr-sm p-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(59,7,100,0.6) 0%, rgba(88,28,135,0.4) 50%, rgba(59,7,100,0.5) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(192,132,252,0.22)',
                boxShadow: `
                  0 8px 32px rgba(59,7,100,0.4),
                  0 2px 8px rgba(168,85,247,0.15),
                  inset 0 1px 0 rgba(192,132,252,0.2)
                `
              }}
            >
              {/* Top shimmer */}
              <div className="absolute top-0 left-[20%] right-[20%] h-px pointer-events-none" style={{
                background: 'linear-gradient(90deg, transparent, rgba(201,132,252,0.6), transparent)'
              }} />

              <p className="text-[#e9d5ff] font-bold text-base mb-3">
                Donna says:
              </p>

              <div className="space-y-3 text-[#e9d5ff]">
                <DonnaMessageBullets
                  entries={entries}
                  reminders={reminders || []}
                />
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
