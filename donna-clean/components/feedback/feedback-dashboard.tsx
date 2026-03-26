"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Star, QrCode, Download, Sparkles, Settings } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  getFeedbackResponses,
  type FeedbackPeriod,
  type FeedbackResponse,
  type BusinessProfile,
} from "@/app/feedback/actions";
import { DEFAULT_FEEDBACK_CATEGORIES } from "@/lib/feedback-constants";
import { CollectFeedbackModal } from "./collect-feedback-modal";
import { FeedbackSettingsPanel } from "./feedback-settings-panel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Maps qr_theme_color value → [header RGB, badge RGB] for PDF generation
const QR_THEME_COLOR_MAP: Record<string, { h: [number, number, number]; b: [number, number, number] }> = {
  purple: { h: [88, 28, 135],  b: [88, 28, 135]  }, // current default — no change for existing users
  red:    { h: [185, 28, 28],  b: [220, 38, 38]  },
  blue:   { h: [30, 64, 175],  b: [37, 99, 235]  },
  green:  { h: [22, 101, 52],  b: [22, 163, 74]  },
  black:  { h: [31, 41, 55],   b: [55, 65, 81]   },
  gold:   { h: [146, 64, 14],  b: [217, 119, 6]  },
};

const PERIOD_OPTIONS: { value: FeedbackPeriod; label: string }[] = [
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "this-year", label: "This Year" },
  { value: "last-year", label: "Last Year" },
  { value: "all-time", label: "All Time" },
  { value: "customize", label: "Customize" },
];


interface Props {
  initialProfile: BusinessProfile | null;
}

function computeStats(
  responses: FeedbackResponse[],
  feedbackCategories: string[]
) {
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
  feedbackCategories.forEach((cat) => {
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
  const [customFromDate, setCustomFromDate] = useState<Date | undefined>();
  const [customToDate, setCustomToDate] = useState<Date | undefined>();
  const [showCustomDatePickers, setShowCustomDatePickers] = useState(false);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    // Convert Date objects to ISO strings for the server action
    const startIso = customFromDate?.toISOString();
    const endIso = customToDate
      ? new Date(
          customToDate.getFullYear(),
          customToDate.getMonth(),
          customToDate.getDate(),
          23, 59, 59, 999
        ).toISOString()
      : undefined;
    const result = await getFeedbackResponses(period, startIso, endIso);
    setResponses(result.responses);
    if (result.businessProfile) setProfile(result.businessProfile);
    setLoading(false);
  }, [period, customFromDate, customToDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeCategories =
    profile?.feedback_categories && profile.feedback_categories.length > 0
      ? profile.feedback_categories
      : DEFAULT_FEEDBACK_CATEGORIES;

  const { average, total, breakdown, categories } = computeStats(responses, activeCategories);

  const slug = profile?.business_slug ?? "";
  const feedbackUrl = `${window.location.origin}/feedback/${slug}`;

  async function handleDownloadPDF() {
    if (!slug) return;

    // High-res QR code
    const QRCode = (await import("qrcode")).default;
    const qrDataUrl = await QRCode.toDataURL(feedbackUrl, {
      width: 600,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });

    const W = 148;
    const H = 210;

    // Resolve theme colors (default to purple for null / unknown values)
    const theme = QR_THEME_COLOR_MAP[profile?.qr_theme_color ?? "purple"] ?? QR_THEME_COLOR_MAP.purple;

    // ── 1. White / very faint lavender background ───────────────
    doc.setFillColor(252, 250, 255); // near-white lavender
    doc.rect(0, 0, W, H, "F");

    // ── 2. Compact header with soft bottom fade ─────────────────
    const headerH = 44;
    doc.setFillColor(...theme.h);
    doc.roundedRect(0, 0, W, headerH, 6, 6, "F");
    // Square off bottom corners
    doc.rect(0, headerH - 8, W, 8, "F");
    // Soft fade strip below header for smooth transition
    doc.setFillColor(200, 180, 230); // light purple fade
    doc.rect(0, headerH, W, 1.5, "F");
    doc.setFillColor(230, 220, 245);
    doc.rect(0, headerH + 1.5, W, 1, "F");

    // ── 3. Headline in header ─────────────────────────────────
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Help us know what you think!", W / 2, 20, { align: "center" });

    // ── 4. Sub-heading in header ──────────────────────────────
    doc.setTextColor(220, 200, 250);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Spare 10 seconds to share", W / 2, 31, { align: "center" });

    // ── 5. Thin gold border frame around QR code ──────────────
    const qrSize = 78;
    const goldPad = 2.5; // thin refined frame
    const qrFrameSize = qrSize + goldPad * 2;
    const qrFrameX = (W - qrFrameSize) / 2;
    const qrFrameY = headerH + 14; // breathing room below header

    // Gold frame — draw as a stroked rounded rect for thin look
    doc.setDrawColor(212, 175, 55); // classic gold #D4AF37
    doc.setLineWidth(1.8);
    doc.roundedRect(qrFrameX, qrFrameY, qrFrameSize, qrFrameSize, 3, 3, "S");

    // White background inside frame for QR
    doc.setFillColor(255, 255, 255);
    doc.rect(qrFrameX + goldPad, qrFrameY + goldPad, qrSize, qrSize, "F");

    // ── 6. QR code inside frame ────────────────────────────────
    doc.addImage(qrDataUrl, "PNG", qrFrameX + goldPad, qrFrameY + goldPad, qrSize, qrSize);

    // ── 7. "Scan to share your feedback" below QR ─────────────
    const belowQrY = qrFrameY + qrFrameSize + 8;
    doc.setTextColor(90, 60, 130);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Scan to share your feedback", W / 2, belowQrY, { align: "center" });

    // ── 8. Business name — compact purple pill badge ───────────
    const badgeY = belowQrY + 12;
    const businessNameText = (profile?.business_name || "Your Business").toUpperCase();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const nameLines = (doc.splitTextToSize(businessNameText, 50) as string[]).slice(0, 2);
    const lineH = 5;
    const badgeH = nameLines.length * lineH + 8;
    const badgeW = 60;
    const badgeX = (W - badgeW) / 2;

    doc.setFillColor(...theme.b);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, badgeH / 2, badgeH / 2, "F");

    doc.setTextColor(255, 255, 255);
    let nameY = badgeY + (badgeH / 2) - ((nameLines.length - 1) * lineH) / 2 + 1;
    for (const line of nameLines) {
      doc.text(line, W / 2, nameY, { align: "center" });
      nameY += lineH;
    }

    // ── 9. Footer ─────────────────────────────────────────────
    doc.setTextColor(170, 160, 190);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("Powered by The Donna", W / 2, H - 8, { align: "center" });

    // ── 10. Save ──────────────────────────────────────────────
    const safeName = (profile?.business_name || "business")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    doc.save(`${safeName}-feedback-qr.pdf`);
  }

  return (
    <div className="space-y-5">
      {/* ── 1. Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Feedback</h1>
          <p className="text-[#94a3b8] text-sm mt-0.5">
            {profile?.business_name ?? "Your Business"}
          </p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95"
          style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)" }}
          aria-label="Feedback Settings"
        >
          <Settings size={18} className="text-[#a855f7]" />
        </button>
      </div>

      {/* ── 2. Collect Feedback Now ───────────────────────────── */}
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

      {/* ── 3. Period Selector ────────────────────────────────── */}
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
            onChange={(e) => {
              const value = e.target.value as FeedbackPeriod;
              setPeriod(value);
              setShowCustomDatePickers(value === "customize");
            }}
            className="px-3 py-1.5 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {showCustomDatePickers && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Popover>
              <PopoverTrigger asChild>
                <button className="px-3 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white text-sm hover:bg-purple-900/50 focus:outline-none focus:ring-2 focus:ring-purple-500">
                  {customFromDate ? format(customFromDate, "MMM dd, yyyy") : "From Date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customFromDate}
                  onSelect={setCustomFromDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <span className="text-[#94a3b8] text-sm">to</span>

            <Popover>
              <PopoverTrigger asChild>
                <button className="px-3 py-2 bg-purple-900/30 border border-purple-500/30 rounded-lg text-white text-sm hover:bg-purple-900/50 focus:outline-none focus:ring-2 focus:ring-purple-500">
                  {customToDate ? format(customToDate, "MMM dd, yyyy") : "To Date"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customToDate}
                  onSelect={setCustomToDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#a855f7] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── 4. Average Rating Card ────────────────────────── */}
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

          {/* ── 5. Rating Breakdown ───────────────────────────── */}
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

          {/* ── 6. Category Breakdown ─────────────────────────── */}
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
                    // Always show all active categories even if 0
                    Object.entries(categories).filter(
                      ([k, v]) =>
                        v.liked === 0 &&
                        v.improve === 0 &&
                        activeCategories.includes(k)
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

          {/* ── 7. Donna's Take ───────────────────────────────── */}
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

      {/* ── 8. QR Code Section ───────────────────────────────── */}
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

        {slug ? (
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white p-3 rounded-xl shadow-lg">
              <QRCodeSVG
                value={feedbackUrl}
                size={200}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            <p className="text-[#94a3b8] text-xs text-center break-all max-w-xs">
              {feedbackUrl}
            </p>

            <div className="flex gap-3 w-full max-w-xs">
              <button
                onClick={handleDownloadPDF}
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
        ) : (
          <div className="flex flex-col items-center py-4">
            <div className="w-6 h-6 border-2 border-[#a855f7] border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-[#64748b] text-xs">Setting up your QR code…</p>
          </div>
        )}
      </div>

      {/* ── Collect Feedback Modal ────────────────────────────── */}
      {showModal && profile && (
        <CollectFeedbackModal
          businessId={profile.id}
          businessName={profile.business_name}
          businessSlug={profile.business_slug}
          categories={activeCategories}
          onClose={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}

      {/* ── Feedback Settings Panel ───────────────────────────── */}
      {showSettings && (
        <FeedbackSettingsPanel
          currentCategories={profile?.feedback_categories ?? null}
          currentThemeColor={profile?.qr_theme_color ?? null}
          onClose={() => setShowSettings(false)}
          onSaved={(cats, themeColor) => {
            setProfile((prev) =>
              prev ? { ...prev, feedback_categories: cats, qr_theme_color: themeColor } : prev
            );
          }}
        />
      )}
    </div>
  );
}
