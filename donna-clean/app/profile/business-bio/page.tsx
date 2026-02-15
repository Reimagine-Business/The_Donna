"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Save } from "lucide-react";

interface BusinessBioData {
  business_type: string;
  what_we_sell: string;
  product_source: string;
  main_customers: string[];
  other_customers: string;
  monthly_sales_range: string;
  extra_notes: string;
}

const CUSTOMER_OPTIONS = [
  "Walk-in customers",
  "Online customers",
  "Corporate clients",
  "Tourists",
  "Local regulars",
  "Students",
  "Businesses",
];

const SALES_RANGES = [
  "Below \u20B950,000",
  "\u20B950,000 \u2013 \u20B91,00,000",
  "\u20B91,00,000 \u2013 \u20B95,00,000",
  "Above \u20B95,00,000",
];

const PRODUCT_SOURCES = [
  "I make them myself",
  "I buy from suppliers",
  "Both (some made, some bought)",
  "I mainly sell services",
];

export default function BusinessBioPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [bio, setBio] = useState<BusinessBioData>({
    business_type: "",
    what_we_sell: "",
    product_source: "",
    main_customers: [],
    other_customers: "",
    monthly_sales_range: "",
    extra_notes: "",
  });

  // Load existing bio on mount
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
              product_source: ctx.product_source || "",
              main_customers: Array.isArray(ctx.main_customers) ? ctx.main_customers : [],
              other_customers: ctx.other_customers || "",
              monthly_sales_range: ctx.monthly_sales_range || "",
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

  // Calculate completion progress
  const filledFields = [
    bio.business_type,
    bio.what_we_sell,
    bio.product_source,
    bio.main_customers.length > 0,
    bio.monthly_sales_range,
  ].filter(Boolean).length;
  const progress = Math.round((filledFields / 5) * 100);

  const toggleCustomer = (customer: string) => {
    setBio((prev) => ({
      ...prev,
      main_customers: prev.main_customers.includes(customer)
        ? prev.main_customers.filter((c) => c !== customer)
        : [...prev.main_customers, customer],
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
        {/* Field 1: Type of Business */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <label className="block">
            <p className="text-white font-medium mb-1">What kind of business do you run?</p>
            <p className="text-white/40 text-xs mb-3">Describe it in your own words</p>
            <input
              type="text"
              value={bio.business_type}
              onChange={(e) => setBio((p) => ({ ...p, business_type: e.target.value }))}
              placeholder="Cafe, Guest house, Retail shop, Service agency..."
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors"
            />
          </label>
        </div>

        {/* Field 2: What do you sell */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <label className="block">
            <p className="text-white font-medium mb-1">What do you sell?</p>
            <p className="text-white/40 text-xs mb-3">List your main products or services</p>
            <textarea
              value={bio.what_we_sell}
              onChange={(e) => setBio((p) => ({ ...p, what_we_sell: e.target.value }))}
              placeholder="Coffee, pastries, rooms for rent, event space, tailoring services..."
              rows={3}
              className="w-full bg-white/5 border border-white/10 focus:border-purple-500/50 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none transition-colors resize-none"
            />
          </label>
        </div>

        {/* Field 3: Product Source */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <p className="text-white font-medium mb-1">Your products are:</p>
          <p className="text-white/40 text-xs mb-3">Helps Donna give better cost and margin advice</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PRODUCT_SOURCES.map((source) => (
              <button
                key={source}
                onClick={() => setBio((p) => ({ ...p, product_source: source }))}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                  bio.product_source === source
                    ? "bg-[#8b5cf6]/30 border-purple-500/60 text-white"
                    : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    bio.product_source === source
                      ? "border-purple-400 bg-purple-400"
                      : "border-white/30"
                  }`}
                >
                  {bio.product_source === source && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </div>
                {source}
              </button>
            ))}
          </div>
        </div>

        {/* Field 4: Main Customers */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <p className="text-white font-medium mb-1">Who are your main customers?</p>
          <p className="text-white/40 text-xs mb-3">Select all that apply</p>
          <div className="flex flex-wrap gap-2">
            {CUSTOMER_OPTIONS.map((customer) => (
              <button
                key={customer}
                onClick={() => toggleCustomer(customer)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                  bio.main_customers.includes(customer)
                    ? "bg-[#8b5cf6]/30 border-purple-500/60 text-white"
                    : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                }`}
              >
                {bio.main_customers.includes(customer) && (
                  <span className="text-purple-400">&#10003;</span>
                )}
                {customer}
              </button>
            ))}
            <button
              onClick={() => toggleCustomer("Other")}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                bio.main_customers.includes("Other")
                  ? "bg-[#8b5cf6]/30 border-purple-500/60 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
              }`}
            >
              + Other
            </button>
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
        </div>

        {/* Field 5: Monthly Sales Range */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
          <p className="text-white font-medium mb-1">Average monthly sales</p>
          <p className="text-white/40 text-xs mb-3">Helps Donna calibrate advice to your scale</p>
          <div className="grid grid-cols-2 gap-2">
            {SALES_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => setBio((p) => ({ ...p, monthly_sales_range: range }))}
                className={`px-4 py-3 rounded-xl border text-sm transition-all text-left ${
                  bio.monthly_sales_range === range
                    ? "bg-[#8b5cf6]/30 border-purple-500/60 text-white font-medium"
                    : "bg-white/5 border-white/10 text-white/60 hover:border-white/20"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Field 6: Extra Notes */}
        <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
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
        </div>
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
