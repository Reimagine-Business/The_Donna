import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { CashpulseShell } from "@/components/cashpulse/cashpulse-shell";
import { SessionExpiredNotice } from "@/components/session-expired-notice";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import { createSupabaseServerClient } from "@/utils/supabase/server";

export default async function CashpulsePage() {
  const supabase = await createSupabaseServerClient();

  const { user, wasInitiallyNull, initialError, refreshError, didRefresh } =
    await getOrRefreshUser(supabase);

  if (wasInitiallyNull) {
    console.warn(
      `[Auth] Session null – error {${
        initialError ? initialError.message : "none"
      }} on cashpulse/page`,
      initialError ?? undefined,
    );
    if (user && didRefresh) {
      console.info("[Auth] Refreshed OK on cashpulse/page");
    }
  }

  if (!user) {
    if (refreshError) {
      console.error(
        `[Auth Fail] Refresh error {${refreshError.message}} on cashpulse/page`,
        refreshError,
      );
      return (
        <main className="min-h-screen bg-slate-950 text-white">
          <div className="flex flex-col gap-10">
            <SiteHeader />
            <section className="px-4 pb-12 md:px-8">
              <div className="mx-auto w-full max-w-6xl">
                <SessionExpiredNotice />
              </div>
            </section>
          </div>
        </main>
      );
    }
    redirect("/auth/login");
  }

  // Then continue with your queries using this supabase client

  const { data: entries, error } = await supabase
    .from("entries")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <div className="flex flex-col gap-10">
          <SiteHeader />
          <section className="px-4 pb-12 md:px-8">
              <div className="mx-auto w-full max-w-6xl">
                <CashpulseShell initialEntries={entries || []} userId={user.id} />
            </div>
          </section>
        </div>
      </main>
    );
}
