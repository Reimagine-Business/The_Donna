import type { SupabaseClient } from "@supabase/supabase-js";

import { Entry } from "@/lib/entries";

type SettleParams = {
  supabase: SupabaseClient;
  entry: Entry;
  amount: number;
  settlementDate: string;
};

export async function settleEntry({
  supabase,
  entry,
  amount,
  settlementDate,
}: SettleParams) {
  const isCredit = entry.entry_type === "Credit";
  const isAdvance = entry.entry_type === "Advance";
  if (!isCredit && !isAdvance) {
    throw new Error("Only Credit and Advance entries can be settled.");
  }

  let settlementEntryType: Entry["entry_type"] | null = null;
  const settlementCategory: Entry["category"] = entry.category;

  if (isCredit) {
    if (entry.category === "Sales") {
      settlementEntryType = "Cash Inflow";
    } else {
      settlementEntryType = "Cash Outflow";
    }
  } else if (isAdvance) {
    if (entry.category === "Sales") {
      settlementEntryType = "Cash Outflow";
    } else if (entry.category === "Assets") {
      settlementEntryType = null;
    } else {
      settlementEntryType = "Cash Outflow";
    }
  }

  if (settlementEntryType) {
    const { error: insertError } = await supabase.from("entries").insert({
      user_id: entry.user_id,
      entry_type: settlementEntryType,
      category: settlementCategory,
      payment_method: entry.payment_method,
      amount,
      entry_date: settlementDate,
      notes: `Settlement of ${entry.entry_type.toLowerCase()} ${entry.id}`,
    });

    if (insertError) {
      throw insertError;
    }
  }

  const { error: updateError } = await supabase
    .from("entries")
    .update({
      settled: true,
      settled_at: settlementDate,
    })
    .eq("id", entry.id);

  if (updateError) {
    throw updateError;
  }
}
