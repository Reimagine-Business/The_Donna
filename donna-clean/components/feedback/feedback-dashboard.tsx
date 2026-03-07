"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Star, QrCode, Download, Sparkles, MessageSquare } from "lucide-react";
import {
  getFeedbackResponses,
  type FeedbackPeriod,
  type FeedbackResponse,
  type BusinessProfile,
} from "@/app/feedback/actions";
import { CollectFeedbackModal } from "./collect-feedback-modal";

const FEEDBACK_CATEGORIES = [
  "Food",
  "Service",
  "Ambience",
  "Value for Money",
  "Cleanliness",
];

const PERIOD_LABELS: Record<FeedbackPeriod, string> = {
  today: "Today",
  "this-week": "This Week",
  "this-month": "This Month",
  custom: "Custom Range",
};

const APP_DOMAIN = "thedonnaapp.co";

interface Props {
  initialProfile: BusinessProfile | null;
}

function computeStats(responses: FeedbackResponse[]) {
  if (responses.length === 0) {
    return {
      average: 0,
      total: 0,
      breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
      categories: {} as Record<string, { liked: number; improve: number }>,
    };
  }

  const total = responses.length;
  const sum = responses.reduce((acc, r) => acc + r.rating, 0);
  const average = sum / total;

  const breakdown = responses.reduce(
    (acc, r) => {
      acc[r.rating] = (acc[r.rating] ?? 0) + 1;
      return acc;
    },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>
  );

  const categories: Record<string, { liked: number; improve: number }> = {};
  FEEDBACK_CATEGORIES.forEach((cat) => {
    categories[cat] = { liked: 0, improve: 0 };
  });

  responses.forEach((r) => {
    r.liked_categories?.forEach((cat) => {
      if (!categories[cat]) categories[cat] = { liked: 0, improve: 0 };
      categories[cat].liked += 1;
    });
    r.improve_categories?.forEach((cat) => {
      if (!categories[cat]) categories[cat] = { liked: 0, improve: 0 };
      categories[cat].improve += 1;
    });
  });

  return { average, total, breakdown, categories };
}

export function FeedbackDashboard({ initialProfile }: Props) {
  const [profile, setProfile] = useState<BusinessProfile | null>(initialProfile);
  const [period, setPeriod] = useState<FeedbackPeriod>("this-month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const result = await getFeedbackResponses(
      period,
      customStart || undefined,
      customEnd || undefined
    );
    setResponses(result.responses);
    if (result.businessProfile) setProfile(result.businessProfile);
    setLoading(false);
  }, [period, customStart, customEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { average, total, breakdown, categories } = computeStats(responses);

  const slug = profile?.business_slug ?? "";
  const feedbackUrl = `https://${APP_DOMAIN}/feedback/${slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(feedbackUrl)}&color=000000&bgcolor=ffffff&qzone=2`;

  async function handleDownloadQR() {
    const res = await fetch(qrUrl);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-feedback-qr.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Feedback</h1>
          <p className="text-[#94a3b8] text-sm mt-0.5">
            {profile?.business_name ?? "Your Business"}
          </p>
        </div>
        <MessageSquare size={28} className="text-[#a855f7]" />
      </div>

      {/* ── Period Selector ───────────────────────────────────── */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "linear-gradient(135deg, rgba(59,7,100,0.5), rgba(15,15,35,0.8))",
          border: "1px solid rgba(192,132,252,0.15)",
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#94a3b8] text-sm font-medium">Period:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as FeedbackPeriod)}
            className="px-3 py-1.5 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {(Object.keys(PERIOD_LABELS) as FeedbackPeriod[]).map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>

          {period === "custom" && (
            <div className="flex items-center gap-2 flex-wrap mt-1 w-full">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-[#94a3b8] text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Collect Feedback Button ───────────────────────────── */}
      <button
        onClick={() => setShowModal(true)}
        className="w-full py-4 rounded-xl font-bold text-white text-base transition-all active:scale-95"
        style={{
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
          boxShadow: "0 4px 20px rgba(168,85,247,0.35)",
        }}
      >
        Collect Feedback Now
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#a855f7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Average Rating Card ───────────────────────────── */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "linear-gradient(135deg, rgba(59,7,100,0.5), rgba(15,15,35,0.8))",
              border: "1px solid rgba(192,132,252,0.15)",
            }}
          >
            <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-semibold mb-3">
              Average Rating
            </p>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-extrabold text-white">
                {total === 0 ? "—" : average.toFixed(1)}
              </span>
              <div className="mb-1">
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={18}
                      className={
                        s <= Math.round(average)
                          ? "text-[#f59e0b] fill-[#f59e0b]"
                          : "text-[#374151]"
                      }
                    />
                  ))}
                </div>
                <p className="text-[#94a3b8] text-xs">
                  {total} {total === 1 ? "response" : "responses"}
                </p>
              </div>
            </div>
          </div>

          {/* ── Rating Breakdown ──────────────────────────────── */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "linear-gradient(135deg, rgba(59,7,100,0.5), rgba(15,15,35,0.8))",
              border: "1px solid rgba(192,132,252,0.15)",
            }}
          >
            <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-semibold mb-4">
              Rating Breakdown
            </p>
            <div className="space-y-2.5">
              {[5, 4, 3, 2, 1].map((score) => {
                const count = breakdown[score] ?? 0;
                const pct = total > 0 ? (count / total) * 100 : 0;
                const emoji = ["", "😞", "😐", "🙂", "😊", "😍"][score];
                return (
                  <div key={score} className="flex items-center gap-3">
                    <span className="text-base w-6">{emoji}</span>
                    <div className="flex-1 bg-[#1e1b4b] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background:
                            score >= 4
                              ? "linear-gradient(90deg, #10b981, #34d399)"
                              : score === 3
                              ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                              : "linear-gradient(90deg, #ef4444, #f87171)",
                        }}
                      />
                    </div>
                    <span className="text-[#e9d5ff] text-sm font-semibold w-6 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Category Breakdown ────────────────────────────── */}
          <div
            className="rounded-xl p-5"
            style={{
              background: "linear-gradient(135deg, rgba(59,7,100,0.5), rgba(15,15,35,0.8))",
              border: "1px solid rgba(192,132,252,0.15)",
            }}
          >
            <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-semibold mb-4">
              Category Breakdown
            </p>
            {total === 0 ? (
              <p className="text-[#64748b] text-sm text-center py-4">
                No responses yet for this period
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(categories)
                  .filter(([, v]) => v.liked > 0 || v.improve > 0)
                  .sort((a, b) => b[1].liked - a[1].liked)
                  .concat(
                    // Always show all default categories even if 0
                    Object.entries(categories).filter(
                      ([k, v]) =>
                        v.liked === 0 &&
                        v.improve === 0 &&
                        FEEDBACK_CATEGORIES.includes(k)
                    )
                  )
                  .filter(
                    ([k], idx, arr) =>
                      arr.findIndex(([kk]) => kk === k) === idx
                  )
                  .map(([cat, { liked, improve }]) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between py-2 border-b"
                      style={{ borderColor: "rgba(192,132,252,0.08)" }}
                    >
                      <span className="text-[#e9d5ff] text-sm font-medium flex-1">
                        {cat}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-emerald-400 font-semibold min-w-[36px] text-right">
                          👍 {liked}
                        </span>
                        <span className="text-sm text-rose-400 font-semibold min-w-[36px] text-right">
                          👎 {improve}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* ── Donna's Take (placeholder) ────────────────────── */}
          <div
            className="rounded-xl p-5 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(59,7,100,0.6), rgba(30,15,60,0.9))",
              border: "1px solid rgba(192,132,252,0.2)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-[#c084fc]" />
              <p className="text-[#c084fc] text-xs uppercase tracking-wider font-semibold">
                Donna&apos;s Take
              </p>
            </div>
            <p className="text-[#e9d5ff] text-sm leading-relaxed opacity-60 italic">
              AI-powered feedback insights coming soon. Donna will help you spot
              patterns, celebrate wins, and flag areas to improve — automatically.
            </p>
          </div>

        </>
      )}

      {/* ── QR Code Section — always visible, independent of period loading ── */}
      {slug ? (
        <div
          className="rounded-xl p-5"
          style={{
            background: "linear-gradient(135deg, rgba(59,7,100,0.5), rgba(15,15,35,0.8))",
            border: "1px solid rgba(192,132,252,0.15)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <QrCode size={16} className="text-[#a855f7]" />
            <p className="text-[#94a3b8] text-xs uppercase tracking-wider font-semibold">
              Your Feedback QR
            </p>
          </div>
          <p className="text-[#64748b] text-xs mb-4">
            Share this with your customers to collect feedback anywhere
          </p>

          <div className="flex flex-col items-center gap-4">
            {/* QR Image */}
            <div className="bg-white p-3 rounded-xl shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt={`QR code for ${feedbackUrl}`}
                width={220}
                height={220}
                className="block"
              />
            </div>

            <p className="text-[#94a3b8] text-xs text-center break-all max-w-xs">
              {feedbackUrl}
            </p>

            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={handleDownloadQR}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[rgba(192,132,252,0.3)] text-[#c084fc] text-sm font-semibold transition-all active:scale-95"
              >
                <Download size={15} />
                Download
              </button>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ url: feedbackUrl, title: `${profile?.business_name} Feedback` });
                  } else {
                    navigator.clipboard.writeText(feedbackUrl);
                  }
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-95"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
              >
                Share Link
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl p-5 text-center"
          style={{
            background: "linear-gradient(135deg, rgba(59,7,100,0.4), rgba(15,15,35,0.7))",
            border: "1px solid rgba(192,132,252,0.1)",
          }}
        >
          <QrCode size={32} className="text-[#4b5563] mx-auto mb-3" />
          <p className="text-[#94a3b8] text-sm font-medium mb-2">
            Your QR code will appear here
          </p>
          <p className="text-[#64748b] text-xs mb-4">
            Complete your Business Bio to activate your QR code
          </p>
          <Link
            href="/profile/business-bio"
            className="inline-block px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
          >
            Complete Business Bio →
          </Link>
        </div>
      )}

      {/* ── Collect Feedback Modal ────────────────────────────── */}
      {showModal && profile && (
        <CollectFeedbackModal
          businessId={profile.id}
          businessName={profile.business_name}
          businessSlug={profile.business_slug}
          onClose={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
