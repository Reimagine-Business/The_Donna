"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { type EntryType, type CategoryType, type PaymentMethod } from "@/lib/entries";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import { createSupabaseServer } from "@/lib/supabase/server";

const entryTypeIsCredit = (type: EntryType): boolean => type === "Credit";

const entryTypeRequiresCashMovement = (type: EntryType): boolean =>
  type === "Cash Inflow" || type === "Cash Outflow" || type === "Advance";

type AddEntryInput = {
  entry_type: EntryType;
  category: CategoryType;
  payment_method: PaymentMethod;
  amount: number;
  entry_date: string;
  notes: string | null;
  image_url: string | null;
};

export async function addEntry(data: AddEntryInput) {
  const supabase = await createSupabaseServer();

  const { user, wasInitiallyNull, initialError, refreshError } = await getOrRefreshUser(supabase);

  if (wasInitiallyNull) {
    console.warn(
      `[Auth] Session null on daily-entries/addEntry – error {${
        initialError ? initialError.message : "none"
      }}`,
      initialError ?? undefined,
    );
  }

  if (!user) {
    if (refreshError) {
      console.error(
        `[Auth Fail] Refresh error {${refreshError.message}} on daily-entries/addEntry`,
        refreshError,
      );
    }
    redirect("/auth/login");
  }

  const amount = Number(data.amount);

  if (!Number.isFinite(amount)) {
    return { error: "Amount must be a valid number." };
  }

  if (entryTypeIsCredit(data.entry_type) && data.payment_method !== "None") {
    return { error: "Credit entries must use Payment Method: None" };
  }

  if (entryTypeRequiresCashMovement(data.entry_type) && data.payment_method === "None") {
    return { error: "This entry type requires actual payment" };
  }

  const shouldTrackRemaining = data.entry_type === "Credit" || data.entry_type === "Advance";

  const payload = {
    user_id: user.id,
    entry_type: data.entry_type,
    category: data.category,
    payment_method: entryTypeIsCredit(data.entry_type) ? "None" : data.payment_method,
    amount,
    remaining_amount: shouldTrackRemaining ? amount : null,
    entry_date: data.entry_date,
    notes: data.notes,
    image_url: data.image_url,
  };

  const { error } = await supabase.from("entries").insert(payload);

  if (error) {
    console.error("Failed to insert entry", error);
    return { error: error.message };
  }

  await supabase
    .from("entries")
    .select("id, user_id")
    .order("created_at", { ascending: false })
    .limit(1);

  revalidatePath("/daily-entries");
  revalidatePath("/cashpulse");
  revalidatePath("/profit-lens");

  return { success: true };
}

type SettleEntryInput = {
  entryId: string;
  amount: number;
  settlementDate: string;
  paymentMethod: PaymentMethod;
};

export async function settleEntry(data: SettleEntryInput) {
  "use server";

  const supabase = await createSupabaseServer();
  const { user, wasInitiallyNull, initialError, refreshError } = await getOrRefreshUser(supabase);

  if (wasInitiallyNull) {
    console.warn(
      `[Auth] Session null on settlements – error {${
        initialError ? initialError.message : "none"
      }}`,
      initialError ?? undefined,
    );
  }

  if (!user) {
    if (refreshError) {
      console.error("[Auth Fail] Refresh error on settlements", refreshError);
    }
    redirect("/auth/login");
  }

  const settledAmount = Number(data.amount);
  if (!Number.isFinite(settledAmount) || settledAmount <= 0) {
    return { error: "Settlement amount must be greater than zero." };
  }

  const { data: originalEntry, error: fetchError } = await supabase
    .from("entries")
    .select("*")
    .eq("id", data.entryId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !originalEntry) {
    return { error: "Entry not found or you don't have permission." };
  }

  if (originalEntry.entry_type !== "Credit" && originalEntry.entry_type !== "Advance") {
    return { error: "Only Credit and Advance entries can be settled." };
  }

  const remainingAmountRaw = originalEntry.remaining_amount ?? originalEntry.amount;
  const remainingAmount = Number(remainingAmountRaw);
  if (!Number.isFinite(remainingAmount)) {
    return { error: "Entry has invalid remaining balance." };
  }

  if (settledAmount > remainingAmount) {
    return { error: "Settlement amount exceeds remaining balance." };
  }

  const nextRemainingAmount = Math.max(remainingAmount - settledAmount, 0);
  const isFullySettled = nextRemainingAmount <= 0;

  if (originalEntry.entry_type === "Credit") {
    const isSales = originalEntry.category === "Sales";
    const newEntryType = isSales ? "Cash Inflow" : "Cash Outflow";

    const { error: insertError } = await supabase.from("entries").insert({
      user_id: user.id,
      entry_type: newEntryType,
      category: originalEntry.category,
      payment_method: data.paymentMethod,
      amount: settledAmount,
      remaining_amount: null,
      entry_date: data.settlementDate,
      notes: `Settlement of ${originalEntry.entry_type} ${originalEntry.category} (ID: ${String(
        originalEntry.id,
      ).slice(0, 8)})`,
      settled: true,
      settled_at: data.settlementDate,
    });

    if (insertError) {
      console.error("Failed to insert settlement entry:", insertError);
      return { error: insertError.message };
    }
  } else if (originalEntry.entry_type === "Advance") {
    if (originalEntry.category !== "Assets") {
      const { error: insertError } = await supabase.from("entries").insert({
        user_id: user.id,
        entry_type: "Credit",
        category: originalEntry.category,
        payment_method: "None",
        amount: settledAmount,
        remaining_amount: null,
        entry_date: data.settlementDate,
        notes: `Settlement of Advance ${originalEntry.category} (ID: ${String(originalEntry.id).slice(0, 8)})`,
        settled: true,
        settled_at: data.settlementDate,
      });

      if (insertError) {
        console.error("Failed to insert advance settlement entry:", insertError);
        return { error: insertError.message };
      }
    }
  }

  const { error: updateError } = await supabase
    .from("entries")
    .update({
      remaining_amount: nextRemainingAmount,
      settled: isFullySettled,
      settled_at: isFullySettled ? data.settlementDate : null,
    })
    .eq("id", data.entryId);

  if (updateError) {
    console.error("Failed to update original entry:", updateError);
    return { error: updateError.message };
  }

  revalidatePath("/daily-entries");
  revalidatePath("/cashpulse");
  revalidatePath("/profit-lens");

  return { success: true };
}
