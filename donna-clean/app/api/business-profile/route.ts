import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";
import { checkRateLimit, RateLimitError } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: 20 requests per minute per user
    try {
      await checkRateLimit(user.id, 'business-profile');
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          { error: "Too many requests. Please try again shortly." },
          { status: 429 }
        );
      }
      console.warn('Rate limit check failed:', error);
    }

    const { data, error } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("[Business Profile] Fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    // If no profile exists yet, return a shell so the client knows
    if (!data) {
      return NextResponse.json({
        profile_completed: false,
        business_context: {},
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Business Profile] GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: 20 requests per minute per user
    try {
      await checkRateLimit(user.id, 'business-profile');
    } catch (error) {
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          { error: "Too many requests. Please try again shortly." },
          { status: 429 }
        );
      }
      console.warn('Rate limit check failed:', error);
    }

    const formData = await req.json();

    // Build business_context JSONB — all Bio fields
    const businessContext: Record<string, unknown> = {
      // Section 1 — Business Identity
      business_name: formData.business_name || null,
      business_type: formData.business_type || null,
      business_description: formData.business_description || null,
      // Section 2 — What You Sell
      what_we_sell: formData.what_we_sell || null,
      product_source: formData.product_source || null,
      // Section 3 — Location & Setting
      city_town: formData.city_town || null,
      area_locality: formData.area_locality || null,
      business_setting: formData.business_setting || null,
      // Section 4 — Your Customers
      main_customers: Array.isArray(formData.main_customers) ? formData.main_customers : null,
      other_customers: formData.other_customers || null,
      payment_methods: Array.isArray(formData.payment_methods) ? formData.payment_methods : null,
      gives_credit: formData.gives_credit === true,
      credit_period: formData.credit_period || null,
      // Section 5 — Business Scale & Maturity
      years_in_business: formData.years_in_business || null,
      team_size: formData.team_size || null,
      monthly_sales_range: formData.monthly_sales_range || null,
      // Section 6 — Your Context Right Now
      biggest_challenge: Array.isArray(formData.biggest_challenge) ? formData.biggest_challenge : null,
      main_goal: Array.isArray(formData.main_goal) ? formData.main_goal : null,
      peak_season: formData.peak_season || null,
      extra_notes: formData.extra_notes || null,
      updated_at: new Date().toISOString(),
    };

    // Try to update first (profile may already exist from trigger)
    const { data: existing } = await supabase
      .from("business_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Update existing profile
      const { data, error } = await supabase
        .from("business_profiles")
        .update({
          business_context: businessContext,
          profile_completed: true,
          profile_completed_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        console.error("[Business Profile] Update error:", error);
        return NextResponse.json(
          { error: "Failed to save profile" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data });
    } else {
      // Insert new profile
      const { data, error } = await supabase
        .from("business_profiles")
        .insert({
          user_id: user.id,
          business_name: formData.business_name || "My Business",
          business_context: businessContext,
          profile_completed: true,
          profile_completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error("[Business Profile] Insert error:", error);
        return NextResponse.json(
          { error: "Failed to create profile" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error("[Business Profile] POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
