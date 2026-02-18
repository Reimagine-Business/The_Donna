"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";
import * as Sentry from "@sentry/nextjs";

// ─────────────────────────────────────────────
// CACHED REMINDER FETCH (60s TTL per user)
// Deduplicates when home + alerts render close together
// ─────────────────────────────────────────────
const reminderCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60_000; // 60 seconds

export async function getReminders(options?: { statusFilter?: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  const cacheKey = `${user.id}:${options?.statusFilter || "all"}`;
  const cached = reminderCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  let query = supabase
    .from("reminders")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true });

  if (options?.statusFilter) {
    query = query.eq("status", options.statusFilter);
  }

  const { data } = await query;
  const result = data || [];

  reminderCache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

export async function createReminder(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Rate limiting: 10 creates per minute per user
  try {
    await checkRateLimit(user.id, 'reminder-create');
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { error: "Too many requests. Please try again shortly." };
    }
    console.warn('Rate limit check failed:', error);
  }

  const title = formData.get("title") as string;
  const dueDate = formData.get("due_date") as string;

  // ✅ FIX: Check for existing pending reminder with same title and due date
  const { data: existing } = await supabase
    .from("reminders")
    .select("id")
    .eq("user_id", user.id)
    .eq("title", title)
    .eq("due_date", dueDate)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { error: "A reminder with this title and due date already exists" };
  }

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: user.id,
      title,
      description: formData.get("description"),
      due_date: dueDate,
      category: formData.get("category"),
      frequency: formData.get("frequency"),
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[createReminder] Insert error:", error);
    Sentry.captureException(error, { tags: { action: 'reminder-create' } });
    return { error: "Something went wrong. Please try again." };
  }

  // If recurring, calculate next_due_date
  if (data.frequency !== "one_time") {
    const nextDueDate = calculateNextDueDate(data.due_date, data.frequency);
    await supabase
      .from("reminders")
      .update({ next_due_date: nextDueDate })
      .eq("id", data.id);
  }

  reminderCache.clear();
  revalidatePath("/alerts");
  revalidatePath("/home");
  return { success: true, data };
}

export async function markReminderDone(reminderId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get reminder details
  const { data: reminder } = await supabase
    .from("reminders")
    .select("*")
    .eq("id", reminderId)
    .maybeSingle();

  if (!reminder) {
    return { error: "Reminder not found" };
  }

  // Mark as completed
  const { error } = await supabase
    .from("reminders")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", reminderId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[markReminderDone] Update error:", error);
    Sentry.captureException(error, { tags: { action: 'reminder-done' } });
    return { error: "Something went wrong. Please try again." };
  }

  // If recurring, create next occurrence
  if (reminder?.frequency !== "one_time") {
    const nextDueDate = calculateNextDueDate(reminder.due_date, reminder.frequency);

    // ✅ FIX: Check if next occurrence already exists before creating
    const { data: existingNext } = await supabase
      .from("reminders")
      .select("id")
      .eq("user_id", user.id)
      .eq("title", reminder.title)
      .eq("due_date", nextDueDate)
      .eq("status", "pending")
      .maybeSingle();

    if (!existingNext) {
      // Only create if it doesn't already exist
      await supabase.from("reminders").insert({
        user_id: user.id,
        title: reminder.title,
        description: reminder.description,
        due_date: nextDueDate,
        category: reminder.category,
        frequency: reminder.frequency,
        status: "pending",
        parent_reminder_id: reminderId,
      });
    }
  }

  reminderCache.clear();
  revalidatePath("/alerts");
  revalidatePath("/home");
  return { success: true };
}

export async function updateReminder(reminderId: string, formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Rate limiting: 15 updates per minute per user
  try {
    await checkRateLimit(user.id, 'reminder-update');
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { error: "Too many requests. Please try again shortly." };
    }
    console.warn('Rate limit check failed:', error);
  }

  const { error } = await supabase
    .from("reminders")
    .update({
      title: formData.get("title"),
      description: formData.get("description"),
      due_date: formData.get("due_date"),
      category: formData.get("category"),
      frequency: formData.get("frequency"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", reminderId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[updateReminder] Update error:", error);
    Sentry.captureException(error, { tags: { action: 'reminder-update' } });
    return { error: "Something went wrong. Please try again." };
  }

  reminderCache.clear();
  revalidatePath("/alerts");
  revalidatePath("/home");
  return { success: true };
}

export async function deleteReminder(reminderId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Rate limiting: 10 deletes per minute per user
  try {
    await checkRateLimit(user.id, 'reminder-delete');
  } catch (error) {
    if (error instanceof RateLimitError) {
      return { error: "Too many requests. Please try again shortly." };
    }
    console.warn('Rate limit check failed:', error);
  }

  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", reminderId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[deleteReminder] Delete error:", error);
    Sentry.captureException(error, { tags: { action: 'reminder-delete' } });
    return { error: "Something went wrong. Please try again." };
  }

  reminderCache.clear();
  revalidatePath("/alerts");
  revalidatePath("/home");
  return { success: true };
}

function calculateNextDueDate(currentDate: string, frequency: string): string {
  const date = new Date(currentDate);

  switch (frequency) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "annually":
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  return date.toISOString().split('T')[0];
}
