import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { TopNavMobile } from "@/components/navigation/top-nav-mobile";
import { FeedbackDashboard } from "@/components/feedback/feedback-dashboard";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOwnerBusinessProfile } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FeedbackPage() {
  const supabase = await createSupabaseServerClient();
  const { user } = await getOrRefreshUser(supabase);

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await getOwnerBusinessProfile();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] text-white pb-24 md:pb-8">
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <TopNavMobile />

        <section className="flex-1 px-4 py-4 md:px-8 overflow-auto">
          <div className="mx-auto w-full max-w-2xl">
            <FeedbackDashboard initialProfile={profile} />
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
