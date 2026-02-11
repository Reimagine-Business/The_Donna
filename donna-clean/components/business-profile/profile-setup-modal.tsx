"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles } from "lucide-react";
import type { BusinessProfileSetupData } from "@/types/business-profile";

interface ProfileSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUESTIONS: {
  field: keyof BusinessProfileSetupData;
  label: string;
  placeholder: string;
  hint: string;
  multiline?: boolean;
}[] = [
  {
    field: "what_we_sell",
    label: "What do you sell or provide?",
    placeholder: "e.g., Custom cakes and catering services",
    hint: "Be specific — this helps Donna give better advice",
  },
  {
    field: "main_customers",
    label: "Who are your main customers?",
    placeholder: "e.g., Wedding planners, event companies, hotels",
    hint: "This helps Donna understand your market",
  },
  {
    field: "peak_season",
    label: "When is your busiest time?",
    placeholder: "e.g., October to March (wedding season)",
    hint: "Helps Donna plan ahead for busy periods",
  },
  {
    field: "typical_monthly_costs",
    label: "What are your typical monthly costs?",
    placeholder: "e.g., ₹85,000 (rent, staff, ingredients, utilities)",
    hint: "Approximate is fine — helps with cash flow advice",
  },
  {
    field: "business_goals",
    label: "What are your business goals?",
    placeholder:
      "e.g., Expand to Guwahati next year, hire 2 more staff, increase profit by 30%",
    hint: "Donna will help you work towards these goals",
    multiline: true,
  },
];

export function ProfileSetupModal({ isOpen, onClose }: ProfileSetupModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState<BusinessProfileSetupData>({
    what_we_sell: "",
    main_customers: "",
    peak_season: "",
    typical_monthly_costs: "",
    business_goals: "",
  });

  const totalSteps = QUESTIONS.length;
  const current = QUESTIONS[step];
  const currentValue = formData[current.field];
  const isLast = step === totalSteps - 1;

  function handleNext() {
    if (!isLast) setStep(step + 1);
  }

  function handleBack() {
    if (step > 0) setStep(step - 1);
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        router.refresh();
        onClose();
      }
    } catch (err) {
      console.error("Error saving profile:", err);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0d0d1a] rounded-2xl border border-purple-500/30 max-w-lg w-full p-6 relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-purple-600/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              Let&apos;s Personalize Donna
            </h2>
            <p className="text-white/60 text-sm">
              Help Donna understand your business better
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white/60 text-sm">
              Question {step + 1} of {totalSteps}
            </span>
            <span className="text-purple-400 text-sm">
              {Math.round(((step + 1) / totalSteps) * 100)}%
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="space-y-4">
          <label className="block">
            <span className="text-white font-medium mb-2 block">
              {current.label}
            </span>
            {current.multiline ? (
              <textarea
                value={currentValue}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    [current.field]: e.target.value,
                  }))
                }
                placeholder={current.placeholder}
                className="w-full bg-purple-900/20 border border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50 min-h-[120px]"
                autoFocus
              />
            ) : (
              <input
                type="text"
                value={currentValue}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    [current.field]: e.target.value,
                  }))
                }
                placeholder={current.placeholder}
                className="w-full bg-purple-900/20 border border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                autoFocus
              />
            )}
            <p className="text-white/40 text-xs mt-2">{current.hint}</p>
          </label>
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button
              onClick={handleBack}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white rounded-xl px-6 py-3 font-medium transition-colors"
            >
              Back
            </button>
          )}

          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={loading || !currentValue}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-purple-800/50 disabled:to-pink-800/50 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3 font-medium transition-colors"
            >
              {loading ? "Saving..." : "Complete Setup"}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={!currentValue}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-purple-800/50 disabled:to-pink-800/50 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3 font-medium transition-colors"
            >
              Next
            </button>
          )}
        </div>

        {/* Skip */}
        <button
          onClick={onClose}
          className="w-full text-white/40 hover:text-white/60 text-sm mt-4 transition-colors"
        >
          I&apos;ll do this later
        </button>
      </div>
    </div>
  );
}
