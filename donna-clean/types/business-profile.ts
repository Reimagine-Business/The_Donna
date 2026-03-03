export interface BusinessProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_context: BusinessContext;
  profile_completed: boolean;
  profile_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessContext {
  // Section 1 — Business Identity
  business_name?: string;
  business_type?: string;
  business_description?: string;

  // Section 2 — What You Sell
  what_we_sell?: string;
  product_source?: string;

  // Section 3 — Location & Setting
  city_town?: string;
  area_locality?: string;
  business_setting?: string;

  // Section 4 — Your Customers
  main_customers?: string[];
  other_customers?: string;
  payment_methods?: string[];
  gives_credit?: boolean;
  credit_period?: string;

  // Section 5 — Business Scale & Maturity
  years_in_business?: string;
  team_size?: string;
  monthly_sales_range?: string;

  // Section 6 — Your Context Right Now
  biggest_challenge?: string;
  main_goal?: string;
  peak_season?: string;
  extra_notes?: string;

  // Setup metadata
  updated_at?: string;

  // Free-form (can add ANYTHING in future)
  [key: string]: unknown;
}

export interface BusinessProfileSetupData {
  what_we_sell: string;
  main_customers: string;
  peak_season: string;
  typical_monthly_costs: string;
  business_goals: string;
}
