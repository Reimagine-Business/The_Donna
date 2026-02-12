import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { getOrRefreshUser } from "@/lib/supabase/get-user";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { user } = await getOrRefreshUser(supabase);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const formData = await req.json();

    // Build business_context JSONB — supports both new Bio fields and old fields
    const businessContext: Record<string, unknown> = {
      business_type: formData.business_type || null,
      what_we_sell: formData.what_we_sell || null,
      product_source: formData.product_source || null,
      main_customers: Array.isArray(formData.main_customers) ? formData.main_customers : (formData.main_customers || null),
      other_customers: formData.other_customers || null,
      monthly_sales_range: formData.monthly_sales_range || null,
      extra_notes: formData.extra_notes || null,
      peak_season: formData.peak_season || null,
      typical_monthly_costs: formData.typical_monthly_costs || null,
      business_goals: formData.business_goals || null,
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
