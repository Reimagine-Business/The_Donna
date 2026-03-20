"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Save } from "lucide-react";

// The 5 editable fields shown in the simplified form
interface SimpleBioFields {
  business_type: string;
  what_we_sell: string;
  main_customers: string[];
  city_town: string;
  main_goal: string[];
}

// Full flat payload the API expects (all 20 fields)
interface FullBioPayload extends SimpleBioFields {
  business_name: string;
  business_description: string;
  product_source: string;
  area_locality: string;
  business_setting: string;
  other_customers: string;
  payment_methods: string[];
  gives_credit: boolean;
  credit_period: string;
  years_in_business: string;
  team_size: string;
  monthly_sales_range: string;
  biggest_challenge: string[];
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

const CUSTOMER_OPTIONS = [
  "Walk-in customers",
  "Online customers",
  "Corporate clients",
  "Tourists",
  "Local regulars",
  "Students",
  "Businesses",
];

const GOALS = [
  "Stay stable",
  "Grow sales",
  "Cut costs",
  "Open new location",
  "Expand products or services",
  "Improve collections",
];

export default function BusinessBioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // The 5 editable fields
  const [bio, setBio] = useState<SimpleBioFields>({
    business_type: "",
    what_we_sell: "",
    main_customers: [],
    city_town: "",
    main_goal: [],
  });

  // Preserve all other existing fields so we don't wipe them on save
  const [preserved, setPreserved] = useState<Omit<FullBioPayload, keyof SimpleBioFields>>({
    business_name: "",
    business_description: "",
    product_source: "",
    area_locality: "",
    business_setting: "",
    other_customers: "",
    payment_methods: [],
    gives_credit: false,
    credit_period: "",
    years_in_business: "",
    team_size: "",
    monthly_sales_range: "",
    biggest_challenge: [],
    peak_season: "",
    extra_notes: "",
  });

  useEffect(() => {
    async function loadBio() {
      try {
        const res = await fetch("/api/business-profile");
        if (res.ok) {
          const data = await res.json();
          if (data?.business_context) {
            const ctx = data.business_context;
            setBio({
              business_type: ctx.business_type || "",
              what_we_sell: ctx.what_we_sell || "",
              main_customers: Array.isArray(ctx.main_customers) ? ctx.main_customers : [],
              city_town: ctx.city_town || "",
              main_goal: Array.isArray(ctx.main_goal)
                ? ctx.main_goal
                : ctx.main_goal
                ? [ctx.main_goal]
                : [],
            });
            setPreserved({
              business_name: ctx.business_name || "",
              business_description: ctx.business_description || "",
              product_source: ctx.product_source || "",
              area_locality: ctx.area_locality || "",
              business_setting: ctx.business_setting || "",
              other_customers: ctx.other_customers || "",
              payment_methods: Array.isArray(ctx.payment_methods) ? ctx.payment_methods : [],
              gives_credit: ctx.gives_credit === true,
              credit_period: ctx.credit_period || "",
              years_in_business: ctx.years_in_business || "",
              team_size: ctx.team_size || "",
              monthly_sales_range: ctx.monthly_sales_range || "",
              biggest_challenge: Array.isArray(ctx.biggest_challenge)
                ? ctx.biggest_challenge
                : ctx.biggest_challenge
                ? [ctx.biggest_challenge]
                : [],
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

  // Progress: count how many of the 5 key fields are filled
  const filledFields = [
    bio.business_type,
    bio.what_we_sell,
    bio.main_customers.length > 0,
    bio.city_town,
    bio.main_goal.length > 0,
  ].filter(Boolean).length;
  const progress = Math.round((filledFields / 5) * 100);

  const toggleMultiSelect = (
    field: "main_customers" | "main_goal",
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
      // Merge edited fields with preserved fields so we don't overwrite existing data
      const payload: FullBioPayload = { ...preserved, ...bio };
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

        {/* Field 1 — Business Type */}
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

        {/* Field 2 — What do you sell? */}
        <FormCard>
          <label className="block">
            <p className="text-white font-medium mb-1">What do you sell?</p>
            <input
              type="text"
              value={bio.what_we_sell}
              onChange={(e) =>
                setBio((p) => ({ ...p, what_we_sell: e.target.value.slice(0, 150) }))
              }
              placeholder="e.g. Coffee, pastries, rooms for rent, tailoring services"
              maxLength={150}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors"
            />
          </label>
        </FormCard>

        {/* Field 3 — Who are your main customers? */}
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
        </FormCard>

        {/* Field 4 — Where is your business? */}
        <FormCard>
          <label className="block">
            <p className="text-white font-medium mb-1">Where is your business?</p>
            <input
              type="text"
              value={bio.city_town}
              onChange={(e) =>
                setBio((p) => ({ ...p, city_town: e.target.value.slice(0, 100) }))
              }
              placeholder="e.g. Police Bazar, Shillong"
              maxLength={100}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors"
            />
          </label>
        </FormCard>

        {/* Field 5 — Main goal for next 6 months */}
        <FormCard>
          <p className="text-white font-medium mb-1">
            What&apos;s your main goal for the next 6 months?
          </p>
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
