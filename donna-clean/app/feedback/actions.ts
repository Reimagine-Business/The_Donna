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

export type FeedbackPeriod = "today" | "this-week" | "this-month" | "custom";

function getPeriodDates(
  period: FeedbackPeriod,
  customStart?: string,
  customEnd?: string
): { startDate: Date; endDate: Date } {
  const endDate = new Date();

  switch (period) {
    case "today": {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate };
    }
    case "this-week": {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - startDate.getDay());
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate };
    }
    case "this-month": {
      const startDate = new Date();
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate };
    }
    case "custom": {
      const startDate = customStart ? new Date(customStart) : new Date(0);
      const customEndDate = customEnd ? new Date(customEnd) : endDate;
      customEndDate.setHours(23, 59, 59, 999);
      return { startDate, endDate: customEndDate };
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

  return data ?? null;
}

export async function saveFeedbackCategories(
  categories: string[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { user } = await getOrRefreshUser(supabase);
  if (!user) return { success: false, error: "Unauthorized" };

  const { error } = await supabase
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

  const { data: responses, error: responsesError } = await supabase
    .from("feedback_responses")
    .select("*")
    .eq("business_id", profile.id)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: false });

  if (responsesError) {
    console.error(
      "[getFeedbackResponses] responses query error:",
      responsesError.message,
      responsesError.code,
      "business_id:", profile.id,
      "period:", period,
      "start:", startDate.toISOString(),
      "end:", endDate.toISOString()
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
