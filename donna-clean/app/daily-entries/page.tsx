import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { DailyEntriesShell } from "@/components/daily-entries/daily-entries-shell";

export default async function DailyEntriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data } = await supabase
    .from("entries")
    .select(
      "id, user_id, entry_type, category, payment_method, amount, entry_date, notes, image_url, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false });

  const entries =
    data?.map((entry) => ({
      ...entry,
      amount: Number(entry.amount),
    })) ?? [];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="flex flex-col gap-10">
        <SiteHeader />
        <section className="px-4 pb-12 md:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <DailyEntriesShell initialEntries={entries} userId={user.id} />
          </div>
        </section>
      </div>
    </main>
  );
}
