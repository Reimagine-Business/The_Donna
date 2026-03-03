"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Save } from "lucide-react";

interface BusinessBioData {
  // Section 1 — Business Identity
  business_name: string;
  business_type: string;
  business_description: string;
  // Section 2 — What You Sell
  what_we_sell: string;
  product_source: string;
  // Section 3 — Location & Setting
  city_town: string;
  area_locality: string;
  business_setting: string;
  // Section 4 — Your Customers
  main_customers: string[];
  other_customers: string;
  payment_methods: string[];
  gives_credit: boolean;
  credit_period: string;
  // Section 5 — Business Scale & Maturity
  years_in_business: string;
  team_size: string;
  monthly_sales_range: string;
  // Section 6 — Your Context Right Now
  biggest_challenge: string[];
  main_goal: string[];
  peak_season: string;
  extra_notes: string;
}

const BUSINESS_TYPES = [
  "Café/Restaurant",
  "Retail Shop",
  "Guest House",
  "Service Business",
  "Food Stall",
  "Online Business",
  "Other",
];

const PRODUCT_SOURCES = [
  "Make myself",
  "Buy from suppliers",
  "Both",
  "Mainly services",
];

const BUSINESS_SETTINGS = [
  "High footfall market area",
  "Residential neighbourhood",
  "Highway or roadside",
  "Online only",
  "Mixed",
];

const CUSTOMER_OPTIONS = [
  "Walk-in customers",
  "Online customers",
  "Corporate clients",
  "Tourists",
  "Local regulars",
  "Students",
  "Businesses",
];

const PAYMENT_OPTIONS = [
  "Cash",
  "UPI",
  "Card",
  "Khata/Credit",
  "Mixed",
];

const CREDIT_PERIODS = [
  "Within a week",
  "15 days",
  "30 days",
  "Longer",
];

const YEARS_IN_BUSINESS = [
  "Less than 1 year",
  "1–3 years",
  "3–5 years",
  "More than 5 years",
];

const TEAM_SIZES = [
  "Just me",
  "2–5",
  "6–15",
  "More than 15",
];

const SALES_RANGES = [
  "Below ₹50,000",
  "₹50,000 – ₹1,00,000",
  "₹1,00,000 – ₹5,00,000",
  "Above ₹5,00,000",
];

const CHALLENGES = [
  "Cash flow",
  "Slow sales",
  "High expenses",
  "Late payments from customers",
  "Managing stock",
  "Growing the business",
  "Finding customers",
];

const GOALS = [
  "Stay stable",
  "Grow sales",
  "Cut costs",
  "Open new location",
  "Expand products or services",
  "Improve collections",
];

const PEAK_SEASONS = [
  "All year",
  "Tourist season Oct–Mar",
  "Festive season",
  "School/college periods",
  "No clear pattern",
];

const EMPTY_BIO: BusinessBioData = {
  business_name: "",
  business_type: "",
  business_description: "",
  what_we_sell: "",
  product_source: "",
  city_town: "",
  area_locality: "",
  business_setting: "",
  main_customers: [],
  other_customers: "",
  payment_methods: [],
  gives_credit: false,
  credit_period: "",
  years_in_business: "",
  team_size: "",
  monthly_sales_range: "",
  biggest_challenge: [],
  main_goal: [],
  peak_season: "",
  extra_notes: "",
};

export default function BusinessBioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bio, setBio] = useState<BusinessBioData>({ ...EMPTY_BIO });

  useEffect(() => {
    async function loadBio() {
      try {
        const res = await fetch("/api/business-profile");
        if (res.ok) {
          const data = await res.json();
          if (data?.business_context) {
            const ctx = data.business_context;
            setBio({
              business_name: ctx.business_name || "",
              business_type: ctx.business_type || "",
              business_description: ctx.business_description || "",
              what_we_sell: ctx.what_we_sell || "",
              product_source: ctx.product_source || "",
              city_town: ctx.city_town || "",
              area_locality: ctx.area_locality || "",
              business_setting: ctx.business_setting || "",
              main_customers: Array.isArray(ctx.main_customers) ? ctx.main_customers : [],
              other_customers: ctx.other_customers || "",
              payment_methods: Array.isArray(ctx.payment_methods) ? ctx.payment_methods : [],
              gives_credit: ctx.gives_credit === true,
              credit_period: ctx.credit_period || "",
              years_in_business: ctx.years_in_business || "",
              team_size: ctx.team_size || "",
              monthly_sales_range: ctx.monthly_sales_range || "",
              biggest_challenge: Array.isArray(ctx.biggest_challenge) ? ctx.biggest_challenge : ctx.biggest_challenge ? [ctx.biggest_challenge] : [],
              main_goal: Array.isArray(ctx.main_goal) ? ctx.main_goal : ctx.main_goal ? [ctx.main_goal] : [],
              peak_season: ctx.peak_season || "",
              extra_notes: ctx.extra_notes || "",
            });
          }
        }
      } catch (e) {
        console.error("Failed to load bio:", e);
      } finally {
        setLoading(false);
      }
    }
    loadBio();
  }, []);

  // Calculate completion progress across all key fields
  const filledFields = [
    bio.business_name,
    bio.business_type,
    bio.what_we_sell,
    bio.product_source,
    bio.city_town,
    bio.business_setting,
    bio.main_customers.length > 0,
    bio.payment_methods.length > 0,
    bio.years_in_business,
    bio.team_size,
    bio.monthly_sales_range,
    bio.biggest_challenge.length > 0,
    bio.main_goal.length > 0,
    bio.peak_season,
  ].filter(Boolean).length;
  const progress = Math.round((filledFields / 14) * 100);

  const toggleMultiSelect = (
    field: "main_customers" | "payment_methods" | "biggest_challenge" | "main_goal",
    value: string
  ) => {
    setBio((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bio),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0e1a]/80 backdrop-blur-sm border-b border-white/5 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <Link href="/profile">
            <button className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h1 className="text-white font-semibold">Business Bio</h1>
          </div>
          <button
            onClick={() => router.push("/profile")}
            className="text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            Skip
          </button>
        </div>

        {/* Progress Bar */}
        <div className="max-w-lg mx-auto mt-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-white/40 text-xs">
              Help Donna know your business <span className="italic">(Optional)</span>
            </p>
            <span className="text-purple-400 text-xs">{progress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-purple-600 to-pink-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {/* ═══════ Section 1 — Business Identity ═══════ */}
        <SectionHeader title="Business Identity" number={1} />

        {/* Business Name */}
        <FormCard>
          <label className="block">
            <p className="text-white font-medium mb-1">Business name</p>
            <input
              type="text"
              value={bio.business_name}
              onChange={(e) => setBio((p) => ({ ...p, business_name: e.target.value }))}
              placeholder="Your business name"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors"
            />
          </label>
        </FormCard>

        {/* Business Type */}
        <FormCard>
          <p className="text-white font-medium mb-3">Business type</p>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_TYPES.map((type) => (
              <PickerButton
                key={type}
                label={type}
                selected={bio.business_type === type}
                onClick={() => setBio((p) => ({ ...p, business_type: type }))}
              />
            ))}
          </div>
        </FormCard>

        {/* Business Description */}
        <FormCard>
          <label className="block">
            <p className="text-white font-medium mb-1">Describe your business in your own words</p>
            <p className="text-white/40 text-xs mb-3">Optional — helps Donna understand your unique story</p>
            <input
              type="text"
              value={bio.business_description}
              onChange={(e) => setBio((p) => ({ ...p, business_description: e.target.value }))}
              placeholder="e.g. Family-run cafe serving traditional Khasi food since 2015"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors text-sm"
            />
          </label>
        </FormCard>

        {/* ═══════ Section 2 — What You Sell ═══════ */}
        <SectionHeader title="What You Sell" number={2} />

        {/* Main Products or Services */}
        <FormCard>
          <label className="block">
            <p className="text-white font-medium mb-1">Main products or services</p>
            <p className="text-white/40 text-xs mb-3">List your main offerings</p>
            <textarea
              value={bio.what_we_sell}
              onChange={(e) => setBio((p) => ({ ...p, what_we_sell: e.target.value }))}
              placeholder="Coffee, pastries, rooms for rent, tailoring services..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors resize-none"
            />
          </label>
        </FormCard>

        {/* Product Source */}
        <FormCard>
          <p className="text-white font-medium mb-1">Product source</p>
          <p className="text-white/40 text-xs mb-3">Helps Donna give better cost and margin advice</p>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_SOURCES.map((source) => (
              <RadioButton
                key={source}
                label={source}
                selected={bio.product_source === source}
                onClick={() => setBio((p) => ({ ...p, product_source: source }))}
              />
            ))}
          </div>
        </FormCard>

        {/* ═══════ Section 3 — Your Location & Setting ═══════ */}
        <SectionHeader title="Your Location & Setting" number={3} />

        {/* City/Town */}
        <FormCard>
          <label className="block">
            <p className="text-white font-medium mb-1">City / Town</p>
            <input
              type="text"
              value={bio.city_town}
              onChange={(e) => setBio((p) => ({ ...p, city_town: e.target.value }))}
              placeholder="e.g. Shillong, Tura, Jowai"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors"
            />
          </label>
        </FormCard>

        {/* Area/Locality */}
        <FormCard>
          <label className="block">
            <p className="text-white font-medium mb-1">Area / Locality within the city</p>
            <input
              type="text"
              value={bio.area_locality}
              onChange={(e) => setBio((p) => ({ ...p, area_locality: e.target.value }))}
              placeholder="e.g. Police Bazar, Laitumkhrah, Mawlai"
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors"
            />
          </label>
        </FormCard>

        {/* Business Setting */}
        <FormCard>
          <p className="text-white font-medium mb-3">Business setting</p>
          <div className="flex flex-wrap gap-2">
            {BUSINESS_SETTINGS.map((setting) => (
              <PickerButton
                key={setting}
                label={setting}
                selected={bio.business_setting === setting}
                onClick={() => setBio((p) => ({ ...p, business_setting: setting }))}
              />
            ))}
          </div>
        </FormCard>

        {/* ═══════ Section 4 — Your Customers ═══════ */}
        <SectionHeader title="Your Customers" number={4} />

        {/* Main Customers */}
        <FormCard>
          <p className="text-white font-medium mb-1">Who are your main customers?</p>
          <p className="text-white/40 text-xs mb-3">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_OPTIONS.map((customer) => (
              <MultiSelectButton
                key={customer}
                label={customer}
                selected={bio.main_customers.includes(customer)}
                onClick={() => toggleMultiSelect("main_customers", customer)}
              />
            ))}
            <MultiSelectButton
              label="+ Other"
              selected={bio.main_customers.includes("Other")}
              onClick={() => toggleMultiSelect("main_customers", "Other")}
            />
          </div>
          {bio.main_customers.includes("Other") && (
            <input
              type="text"
              value={bio.other_customers}
              onChange={(e) => setBio((p) => ({ ...p, other_customers: e.target.value }))}
              placeholder="Describe your other customers..."
              className="w-full mt-3 bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors text-sm"
            />
          )}
        </FormCard>

        {/* Payment Methods */}
        <FormCard>
          <p className="text-white font-medium mb-1">How do customers usually pay?</p>
          <p className="text-white/40 text-xs mb-3">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_OPTIONS.map((method) => (
              <MultiSelectButton
                key={method}
                label={method}
                selected={bio.payment_methods.includes(method)}
                onClick={() => toggleMultiSelect("payment_methods", method)}
              />
            ))}
          </div>
        </FormCard>

        {/* Credit Toggle */}
        <FormCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Do you give credit to customers?</p>
              <p className="text-white/40 text-xs mt-1">Helps Donna track collections</p>
            </div>
            <button
              onClick={() => setBio((p) => ({
                ...p,
                gives_credit: !p.gives_credit,
                credit_period: !p.gives_credit ? p.credit_period : "",
              }))}
              className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${
                bio.gives_credit ? "bg-purple-600" : "bg-white/20"
              }`}
            >
              <div
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  bio.gives_credit ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>
          {bio.gives_credit && (
            <div className="mt-4">
              <p className="text-white/60 text-sm mb-2">Typical credit period</p>
              <div className="flex flex-wrap gap-2">
                {CREDIT_PERIODS.map((period) => (
                  <PickerButton
                    key={period}
                    label={period}
                    selected={bio.credit_period === period}
                    onClick={() => setBio((p) => ({ ...p, credit_period: period }))}
                  />
                ))}
              </div>
            </div>
          )}
        </FormCard>

        {/* ═══════ Section 5 — Business Scale & Maturity ═══════ */}
        <SectionHeader title="Business Scale & Maturity" number={5} />

        {/* Years in Business */}
        <FormCard>
          <p className="text-white font-medium mb-3">How long have you been in business?</p>
          <div className="grid grid-cols-2 gap-2">
            {YEARS_IN_BUSINESS.map((option) => (
              <RadioButton
                key={option}
                label={option}
                selected={bio.years_in_business === option}
                onClick={() => setBio((p) => ({ ...p, years_in_business: option }))}
              />
            ))}
          </div>
        </FormCard>

        {/* Team Size */}
        <FormCard>
          <p className="text-white font-medium mb-3">Number of people working</p>
          <div className="grid grid-cols-2 gap-2">
            {TEAM_SIZES.map((size) => (
              <RadioButton
                key={size}
                label={size}
                selected={bio.team_size === size}
                onClick={() => setBio((p) => ({ ...p, team_size: size }))}
              />
            ))}
          </div>
        </FormCard>

        {/* Monthly Sales Range */}
        <FormCard>
          <p className="text-white font-medium mb-1">Average monthly sales</p>
          <p className="text-white/40 text-xs mb-3">Helps Donna calibrate advice to your scale</p>
          <div className="grid grid-cols-2 gap-2">
            {SALES_RANGES.map((range) => (
              <RadioButton
                key={range}
                label={range}
                selected={bio.monthly_sales_range === range}
                onClick={() => setBio((p) => ({ ...p, monthly_sales_range: range }))}
              />
            ))}
          </div>
        </FormCard>

        {/* ═══════ Section 6 — Your Context Right Now ═══════ */}
        <SectionHeader title="Your Context Right Now" number={6} />

        {/* Biggest Challenge */}
        <FormCard>
          <p className="text-white font-medium mb-1">Biggest current challenge</p>
          <p className="text-white/40 text-xs mb-3">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {CHALLENGES.map((challenge) => (
              <MultiSelectButton
                key={challenge}
                label={challenge}
                selected={bio.biggest_challenge.includes(challenge)}
                onClick={() => toggleMultiSelect("biggest_challenge", challenge)}
              />
            ))}
          </div>
        </FormCard>

        {/* Main Goal */}
        <FormCard>
          <p className="text-white font-medium mb-1">Your main goal for the next 6 months</p>
          <p className="text-white/40 text-xs mb-3">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {GOALS.map((goal) => (
              <MultiSelectButton
                key={goal}
                label={goal}
                selected={bio.main_goal.includes(goal)}
                onClick={() => toggleMultiSelect("main_goal", goal)}
              />
            ))}
          </div>
        </FormCard>

        {/* Peak Season */}
        <FormCard>
          <p className="text-white font-medium mb-3">Peak business season</p>
          <div className="flex flex-wrap gap-2">
            {PEAK_SEASONS.map((season) => (
              <PickerButton
                key={season}
                label={season}
                selected={bio.peak_season === season}
                onClick={() => setBio((p) => ({ ...p, peak_season: season }))}
              />
            ))}
          </div>
        </FormCard>

        {/* Extra Notes */}
        <FormCard>
          <label className="block">
            <p className="text-white font-medium mb-1">Anything else Donna should know?</p>
            <p className="text-white/40 text-xs mb-3">
              Busy season? Planning expansion? Facing cash issues? Tell Donna anything important.
            </p>
            <textarea
              value={bio.extra_notes}
              onChange={(e) => setBio((p) => ({ ...p, extra_notes: e.target.value }))}
              placeholder="e.g. We're busiest October to March. Planning to open a second location next year. Currently dealing with slow collections..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors resize-none text-sm"
            />
          </label>
        </FormCard>
      </div>

      {/* Sticky Save Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0e1a] to-transparent">
        <div className="max-w-lg mx-auto space-y-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white rounded-2xl px-6 py-4 font-semibold flex items-center justify-center gap-2 transition-all"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <span>Saved!</span>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Business Bio
              </>
            )}
          </button>
          <button
            onClick={() => router.push("/profile")}
            className="w-full text-white/40 hover:text-white/60 text-sm py-2 transition-colors"
          >
            I&apos;ll do this later
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════ Shared Sub-Components ═══════

function SectionHeader({ title, number }: { title: string; number: number }) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-xs text-purple-300 font-semibold flex-shrink-0">
        {number}
      </div>
      <h2 className="text-white/80 font-semibold text-sm uppercase tracking-wide">{title}</h2>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
      {children}
    </div>
  );
}

function PickerButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-xl border text-sm transition-all ${
        selected
          ? "bg-[#8b5cf6]/30 border-purple-500/60 text-white font-medium"
          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
      }`}
    >
      {label}
    </button>
  );
}

function RadioButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm text-left transition-all ${
        selected
          ? "bg-[#8b5cf6]/30 border-purple-500/60 text-white"
          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
      }`}
    >
      <div
        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          selected ? "border-purple-400 bg-purple-400" : "border-white/30"
        }`}
      >
        {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
      </div>
      {label}
    </button>
  );
}

function MultiSelectButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
        selected
          ? "bg-[#8b5cf6]/30 border-purple-500/60 text-white"
          : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
      }`}
    >
      {selected && <span className="text-purple-400">&#10003;</span>}
      {label}
    </button>
  );
}
