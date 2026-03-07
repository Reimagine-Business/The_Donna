"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const FEEDBACK_CATEGORIES = [
  "Food",
  "Service",
  "Ambience",
  "Value for Money",
  "Cleanliness",
];

const RATING_EMOJIS = [
  { score: 1, emoji: "😞", label: "Terrible" },
  { score: 2, emoji: "😐", label: "Not Great" },
  { score: 3, emoji: "🙂", label: "Okay" },
  { score: 4, emoji: "😊", label: "Good" },
  { score: 5, emoji: "😍", label: "Amazing" },
];

type Step = "welcome" | "rating" | "chips" | "comment" | "thankyou";

interface Props {
  businessId: string;
  businessName: string;
  businessSlug: string;
  collectionMode: "qr" | "direct";
  onComplete?: () => void;
}

export function CustomerFeedbackForm({
  businessId,
  businessName,
  businessSlug,
  collectionMode,
  onComplete,
}: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [rating, setRating] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSubmit(finalComment?: string) {
    setSubmitting(true);
    setError(null);

    const commentToSave = finalComment ?? comment;
    const isPositive = (rating ?? 0) >= 4;

    const { error: dbError } = await supabase.from("feedback_responses").insert({
      business_id: businessId,
      business_slug: businessSlug,
      rating,
      liked_categories: isPositive && selectedCategories.length > 0 ? selectedCategories : null,
      improve_categories:
        !isPositive && selectedCategories.length > 0 ? selectedCategories : null,
      comment: commentToSave.trim() || null,
      collection_mode: collectionMode,
    });

    setSubmitting(false);

    if (dbError) {
      setError("Something went wrong. Please try again.");
      return;
    }

    setStep("thankyou");
    if (onComplete) {
      setTimeout(onComplete, 2500);
    }
  }

  // ── WELCOME ────────────────────────────────────────────────
  if (step === "welcome") {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
        <div className="text-6xl mb-6">👋</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-3">{businessName}</h1>
        <p className="text-xl text-gray-600 mb-10 leading-relaxed">
          How was your experience at{" "}
          <span className="font-semibold text-gray-800">{businessName}</span> today?
        </p>
        <button
          onClick={() => setStep("rating")}
          className="bg-violet-600 text-white px-10 py-4 rounded-2xl text-lg font-semibold shadow-lg active:scale-95 transition-transform"
        >
          Share Feedback
        </button>
      </div>
    );
  }

  // ── RATING ─────────────────────────────────────────────────
  if (step === "rating") {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
        <p className="text-sm text-gray-400 uppercase tracking-widest mb-3 font-medium">
          Step 1 of 3
        </p>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Rate your visit</h2>
        <p className="text-gray-500 mb-10">Tap an emoji to rate</p>

        <div className="flex items-center justify-center gap-3 mb-8 flex-wrap">
          {RATING_EMOJIS.map(({ score, emoji, label }) => (
            <button
              key={score}
              onClick={() => {
                setRating(score);
                setSelectedCategories([]);
                setTimeout(() => setStep("chips"), 300);
              }}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all active:scale-90 ${
                rating === score
                  ? "bg-violet-100 ring-2 ring-violet-400 scale-110"
                  : "bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <span className="text-5xl leading-none">{emoji}</span>
              <span className="text-xs text-gray-500 font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── CHIPS ──────────────────────────────────────────────────
  if (step === "chips") {
    const isPositive = (rating ?? 0) >= 4;
    const question = isPositive ? "What did you love?" : "What can we do better?";

    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
        <p className="text-sm text-gray-400 uppercase tracking-widest mb-3 font-medium">
          Step 2 of 3
        </p>
        <div className="text-4xl mb-4">
          {RATING_EMOJIS.find((r) => r.score === rating)?.emoji}
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{question}</h2>
        <p className="text-gray-500 mb-8 text-sm">Select at least one</p>

        <div className="flex flex-wrap justify-center gap-3 mb-10 max-w-sm">
          {FEEDBACK_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-5 py-3 rounded-full text-sm font-semibold border-2 transition-all active:scale-95 ${
                selectedCategories.includes(cat)
                  ? "bg-violet-600 border-violet-600 text-white shadow-md"
                  : "bg-white border-gray-200 text-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          disabled={selectedCategories.length === 0}
          onClick={() => setStep("comment")}
          className="bg-violet-600 text-white px-10 py-4 rounded-2xl text-lg font-semibold shadow-lg active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    );
  }

  // ── COMMENT ────────────────────────────────────────────────
  if (step === "comment") {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
        <p className="text-sm text-gray-400 uppercase tracking-widest mb-3 font-medium">
          Step 3 of 3
        </p>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Anything else to share?</h2>
        <p className="text-gray-400 mb-6 text-sm">This is optional — feel free to skip</p>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Write your thoughts here..."
          rows={4}
          maxLength={500}
          className="w-full max-w-sm p-4 border-2 border-gray-200 rounded-2xl text-gray-700 text-base resize-none focus:outline-none focus:border-violet-400 mb-6"
        />

        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        <div className="flex gap-3 w-full max-w-sm">
          <button
            onClick={() => handleSubmit("")}
            disabled={submitting}
            className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-500 font-semibold text-base active:scale-95 transition-all disabled:opacity-40"
          >
            Skip
          </button>
          <button
            onClick={() => handleSubmit(comment)}
            disabled={submitting}
            className="flex-1 bg-violet-600 text-white py-4 rounded-2xl text-base font-semibold shadow-lg active:scale-95 transition-all disabled:opacity-40"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    );
  }

  // ── THANK YOU ──────────────────────────────────────────────
  if (step === "thankyou") {
    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
        <div className="text-7xl mb-6">🙏</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-4">Thank you!</h2>
        <p className="text-xl text-gray-600 leading-relaxed max-w-sm">
          <span className="font-semibold text-gray-800">{businessName}</span> appreciates
          your feedback.
        </p>
      </div>
    );
  }

  return null;
}
