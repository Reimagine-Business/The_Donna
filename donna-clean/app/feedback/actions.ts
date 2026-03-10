"use server";

import { createSupabaseServerClient } from "@/utils/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getOrRefreshUser } from "@/lib/supabase/get-user";

export interface FeedbackResponse {
  id: string;
  business_id: string;
  business_slug: string;
  rating: number;
  liked_categories: string[] | null;
  improve_categories: string[] | null;
  comment: string | null;
  collection_mode: string | null;
  created_at: string;
}

export interface BusinessProfile {
  id: string;
  business_name: string;
  business_slug: string;
  feedback_categories: string[] | null;
}

export type FeedbackPeriod =
  | "this-month"
  | "last-month"
  | "this-year"
  | "last-year"
  | "all-time"
  | "customize";

function getPeriodDates(
  period: FeedbackPeriod,
  customStart?: string,
  customEnd?: string
): { startDate: Date | null; endDate: Date | null } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case "this-month":
      return {
        startDate: new Date(year, month, 1, 0, 0, 0, 0),
        endDate: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
    case "last-month": {
      const lm = month === 0 ? 11 : month - 1;
      const ly = month === 0 ? year - 1 : year;
      return {
        startDate: new Date(ly, lm, 1, 0, 0, 0, 0),
        endDate: new Date(ly, lm + 1, 0, 23, 59, 59, 999),
      };
    }
    case "this-year":
      return {
        startDate: new Date(year, 0, 1, 0, 0, 0, 0),
        endDate: new Date(year, month, now.getDate(), 23, 59, 59, 999),
      };
    case "last-year":
      return {
        startDate: new Date(year - 1, 0, 1, 0, 0, 0, 0),
        endDate: new Date(year - 1, 11, 31, 23, 59, 59, 999),
      };
    case "all-time":
      return { startDate: null, endDate: null };
    case "customize": {
      const startDate = customStart ? new Date(customStart) : null;
      const endDate = customEnd ? new Date(customEnd) : null;
      if (endDate) endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    }
  }
}

export async function getOwnerBusinessProfile(): Promise<BusinessProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { user } = await getOrRefreshUser(supabase);
  if (!user) return null;

  const { data, error } = await supabase
    .from("business_profiles")
    .select("id, business_name, business_slug, feedback_categories")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getOwnerBusinessProfile] select error:", error.message, error.code);
    // Fallback: select without feedback_categories in case the column doesn't exist yet
    const { data: fallback, error: fbErr } = await supabase
      .from("business_profiles")
      .select("id, business_name, business_slug")
      .eq("user_id", user.id)
      .maybeSingle();
    if (fbErr) console.error("[getOwnerBusinessProfile] fallback error:", fbErr.message);
    return fallback ? { ...fallback, feedback_categories: null } : null;
  }

  // No profile row yet — create a minimal one so the QR code works immediately
  if (!data) {
    const autoSlug = user.id.replace(/-/g, "").slice(0, 12);
    const { data: inserted, error: insertErr } = await supabase
      .from("business_profiles")
      .insert({ user_id: user.id, business_name: "My Business", business_slug: autoSlug })
      .select("id, business_name, business_slug, feedback_categories")
      .single();
    if (insertErr) {
      console.error("[getOwnerBusinessProfile] insert error:", insertErr.message);
      return null;
    }
    return inserted;
  }

  // Profile exists but no slug — generate one now
  if (!data.business_slug) {
    const autoSlug = user.id.replace(/-/g, "").slice(0, 12);
    const { data: updated, error: updateErr } = await supabase
      .from("business_profiles")
      .update({ business_slug: autoSlug })
      .eq("user_id", user.id)
      .select("id, business_name, business_slug, feedback_categories")
      .single();
    if (updateErr) {
      console.error("[getOwnerBusinessProfile] slug update error:", updateErr.message);
      return { ...data, business_slug: autoSlug }; // return with local slug even if save failed
    }
    return updated;
  }

  return data;
}

export async function saveFeedbackCategories(
  categories: string[]
): Promise<{ success: boolean; error?: string }> {
  // Verify the caller is authenticated before touching any data
  const supabase = await createSupabaseServerClient();
  const { user } = await getOrRefreshUser(supabase);
  if (!user) return { success: false, error: "Unauthorized" };

  // Use service-role client so the UPDATE is never silently blocked by an
  // RLS policy gap.  We still scope the write to the authenticated user's
  // own row via the .eq("user_id", user.id) filter, so this is safe.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await supabaseAdmin
    .from("business_profiles")
    .update({ feedback_categories: categories })
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getFeedbackResponses(
  period: FeedbackPeriod,
  customStart?: string,
  customEnd?: string
): Promise<{ responses: FeedbackResponse[]; businessProfile: BusinessProfile | null }> {
  const supabase = await createSupabaseServerClient();
  const { user } = await getOrRefreshUser(supabase);
  if (!user) return { responses: [], businessProfile: null };

  let profile: BusinessProfile | null = null;
  {
    const { data, error } = await supabase
      .from("business_profiles")
      .select("id, business_name, business_slug, feedback_categories")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[getFeedbackResponses] profile select error:", error.message, error.code);
      // Fallback without feedback_categories
      const { data: fallback, error: fbErr } = await supabase
        .from("business_profiles")
        .select("id, business_name, business_slug")
        .eq("user_id", user.id)
        .maybeSingle();
      if (fbErr) console.error("[getFeedbackResponses] profile fallback error:", fbErr.message);
      profile = fallback ? { ...fallback, feedback_categories: null } : null;
    } else {
      profile = data ?? null;
    }
  }

  if (!profile) return { responses: [], businessProfile: null };

  const { startDate, endDate } = getPeriodDates(period, customStart, customEnd);

  let query = supabase
    .from("feedback_responses")
    .select("*")
    .eq("business_id", profile.id)
    .order("created_at", { ascending: false });

  if (startDate) query = query.gte("created_at", startDate.toISOString());
  if (endDate) query = query.lte("created_at", endDate.toISOString());

  const { data: responses, error: responsesError } = await query;

  if (responsesError) {
    console.error(
      "[getFeedbackResponses] responses query error:",
      responsesError.message,
      responsesError.code,
      "business_id:", profile.id,
      "period:", period,
      "start:", startDate?.toISOString(),
      "end:", endDate?.toISOString()
    );
  }

  return {
    responses: responses ?? [],
    businessProfile: profile,
  };
}

export async function getBusinessBySlug(slug: string): Promise<{
  id: string;
  business_name: string;
  business_slug: string;
  feedback_categories: string[] | null;
} | null> {
  // Use service-role client to bypass RLS — this is a public server-side
  // lookup (customer feedback page, no session). The anon key would be
  // blocked by the existing business_profiles RLS policies.
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data } = await supabaseAdmin
    .from("business_profiles")
    .select("id, business_name, business_slug, feedback_categories")
    .eq("business_slug", slug)
    .maybeSingle();

  return data ?? null;
}
