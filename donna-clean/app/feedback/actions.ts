"use server";

import { createSupabaseServerClient } from "@/utils/supabase/server";
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

  const { data } = await supabase
    .from("business_profiles")
    .select("id, business_name, business_slug")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ?? null;
}

export async function getFeedbackResponses(
  period: FeedbackPeriod,
  customStart?: string,
  customEnd?: string
): Promise<{ responses: FeedbackResponse[]; businessProfile: BusinessProfile | null }> {
  const supabase = await createSupabaseServerClient();
  const { user } = await getOrRefreshUser(supabase);
  if (!user) return { responses: [], businessProfile: null };

  const { data: profile } = await supabase
    .from("business_profiles")
    .select("id, business_name, business_slug")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return { responses: [], businessProfile: null };

  const { startDate, endDate } = getPeriodDates(period, customStart, customEnd);

  const { data: responses } = await supabase
    .from("feedback_responses")
    .select("*")
    .eq("business_id", profile.id)
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: false });

  return {
    responses: responses ?? [],
    businessProfile: profile,
  };
}

export async function getBusinessBySlug(
  slug: string
): Promise<{ id: string; business_name: string; business_slug: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("business_profiles")
    .select("id, business_name, business_slug")
    .eq("business_slug", slug)
    .maybeSingle();

  return data ?? null;
}
