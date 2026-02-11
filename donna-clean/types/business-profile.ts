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
  // Core business info
  what_we_sell?: string;
  industry?: string;
  business_type?: "B2B" | "B2C" | "Both";

  // Financial patterns
  typical_monthly_revenue?: number;
  typical_monthly_costs?: string;
  peak_season?: string;
  slow_season?: string;

  // Customer info
  main_customers?: string;
  payment_terms?: string;

  // Business stage
  years_in_business?: number;
  business_stage?: "Startup" | "Growing" | "Established";

  // Goals & style
  business_goals?: string;
  decision_style?: "Conservative" | "Moderate" | "Aggressive";

  // Location & cultural
  primary_location?: string;
  serves_tourists?: boolean;

  // Setup metadata
  setup_completed_at?: string;

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
