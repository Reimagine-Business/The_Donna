import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { TopNavMobile } from "@/components/navigation/top-nav-mobile";
import { AlertsPageClient } from "@/components/alerts/alerts-page-client";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getReminders } from "@/app/reminders/actions";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AlertsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/auth/login");
  }

  const reminders = await getReminders();

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0f0f23] to-[#1a1a2e] text-white pb-24 md:pb-8">
      <div className="flex flex-col min-h-screen">
        <SiteHeader />
        <TopNavMobile />

        <section className="flex-1 px-4 py-4 md:px-8 overflow-auto">
          <div className="mx-auto w-full max-w-6xl">
            <AlertsPageClient initialReminders={reminders} />
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
