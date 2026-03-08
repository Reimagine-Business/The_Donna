"use client";

import { useState } from "react";
import { X, Plus, Check } from "lucide-react";
import { saveFeedbackCategories, DEFAULT_FEEDBACK_CATEGORIES } from "@/app/feedback/actions";

const PRESET_CATEGORIES = [
  "Food",
  "Service",
  "Ambience",
  "Value for Money",
  "Cleanliness",
  "Room Quality",
  "Check-in Experience",
  "Location",
  "Staff Friendliness",
  "Speed",
  "Product Quality",
  "Pricing",
  "Store Experience",
  "Packaging",
  "Delivery",
];

const MAX_SELECTED = 8;
const MIN_SELECTED = 2;
const MAX_CUSTOM = 3;

interface Props {
  currentCategories: string[] | null;
  onClose: () => void;
  onSaved: (categories: string[]) => void;
}

export function FeedbackSettingsPanel({ currentCategories, onClose, onSaved }: Props) {
  const initial = currentCategories && currentCategories.length > 0
    ? currentCategories
    : DEFAULT_FEEDBACK_CATEGORIES;

  // Separate preset from custom
  const initialCustom = initial.filter((c) => !PRESET_CATEGORIES.includes(c));

  const [selected, setSelected] = useState<string[]>(initial);
  const [customCategories, setCustomCategories] = useState<string[]>(initialCustom);
  const [newCustom, setNewCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(cat: string) {
    setSelected((prev) => {
      if (prev.includes(cat)) {
        if (prev.length <= MIN_SELECTED) return prev; // enforce minimum
        return prev.filter((c) => c !== cat);
      } else {
        if (prev.length >= MAX_SELECTED) return prev; // enforce maximum
        return [...prev, cat];
      }
    });
  }

  function addCustomCategory() {
    const trimmed = newCustom.trim();
    if (!trimmed) return;
    if (customCategories.length >= MAX_CUSTOM) return;
    if (PRESET_CATEGORIES.includes(trimmed) || customCategories.includes(trimmed)) {
      setNewCustom("");
      return;
    }
    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    // Auto-select new custom category if under limit
    setSelected((prev) =>
      prev.length < MAX_SELECTED ? [...prev, trimmed] : prev
    );
    setNewCustom("");
  }

  async function handleSave() {
    if (selected.length < MIN_SELECTED) {
      setError(`Please select at least ${MIN_SELECTED} categories.`);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveFeedbackCategories(selected);
    setSaving(false);
    if (!result.success) {
      setError(result.error || "Failed to save. Please try again.");
      return;
    }
    setSaved(true);
    onSaved(selected);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  }

  const allChips = [
    ...PRESET_CATEGORIES,
    ...customCategories.filter((c) => !PRESET_CATEGORIES.includes(c)),
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center md:items-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl md:rounded-2xl flex flex-col max-h-[90vh]"
        style={{
          background: "linear-gradient(160deg, #1a0a2e, #0f0f23)",
          border: "1px solid rgba(192,132,252,0.2)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "rgba(192,132,252,0.12)" }}
        >
          <div>
            <h2 className="text-white font-bold text-lg">Feedback Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#94a3b8] hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.06)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Section 1 — Category chips */}
          <div>
            <p className="text-white font-semibold text-base mb-1">
              What do you want feedback on?
            </p>
            <p className="text-[#94a3b8] text-sm mb-1">
              Customers will see these as options when rating your business.
            </p>
            <p className="text-[#c084fc] text-xs font-semibold mb-4">
              {selected.length} of {MAX_SELECTED} selected
              {selected.length <= MIN_SELECTED && (
                <span className="text-[#94a3b8] font-normal ml-2">(minimum {MIN_SELECTED})</span>
              )}
            </p>

            <div className="flex flex-wrap gap-2">
              {allChips.map((cat) => {
                const isSelected = selected.includes(cat);
                const isCustom = !PRESET_CATEGORIES.includes(cat);
                const atMax = selected.length >= MAX_SELECTED && !isSelected;

                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    disabled={atMax}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95 flex items-center gap-1.5 ${
                      isSelected
                        ? "text-white border-transparent"
                        : "border-[rgba(192,132,252,0.3)] text-[#94a3b8] hover:border-[rgba(192,132,252,0.6)] hover:text-[#e9d5ff]"
                    } ${atMax ? "opacity-40 cursor-not-allowed" : ""}`}
                    style={
                      isSelected
                        ? { background: "linear-gradient(135deg, #7c3aed, #a855f7)" }
                        : { background: "rgba(255,255,255,0.04)" }
                    }
                  >
                    {cat}
                    {isCustom && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: isSelected
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(168,85,247,0.25)",
                          color: isSelected ? "#fff" : "#c084fc",
                        }}
                      >
                        custom
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2 — Add custom */}
          <div>
            <p className="text-white font-semibold text-base mb-1">Add your own</p>
            <p className="text-[#94a3b8] text-sm mb-3">
              {customCategories.length} of {MAX_CUSTOM} custom categories added
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={newCustom}
                onChange={(e) => setNewCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustomCategory(); }}
                placeholder="e.g. WiFi, Parking, Presentation…"
                maxLength={30}
                disabled={customCategories.length >= MAX_CUSTOM}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-[#4b5563] focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(192,132,252,0.2)",
                }}
              />
              <button
                onClick={addCustomCategory}
                disabled={!newCustom.trim() || customCategories.length >= MAX_CUSTOM}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
              >
                <Plus size={18} />
              </button>
            </div>
            {customCategories.length >= MAX_CUSTOM && (
              <p className="text-[#94a3b8] text-xs mt-2">
                Maximum {MAX_CUSTOM} custom categories reached.
              </p>
            )}
          </div>

          {error && (
            <p className="text-rose-400 text-sm">{error}</p>
          )}
        </div>

        {/* Save button */}
        <div
          className="px-5 py-4 border-t"
          style={{ borderColor: "rgba(192,132,252,0.12)" }}
        >
          <button
            onClick={handleSave}
            disabled={saving || saved || selected.length < MIN_SELECTED}
            className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: saved
                ? "linear-gradient(135deg, #059669, #10b981)"
                : "linear-gradient(135deg, #7c3aed, #a855f7)",
              boxShadow: "0 4px 20px rgba(168,85,247,0.3)",
            }}
          >
            {saved ? (
              <>
                <Check size={18} />
                Feedback categories updated.
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
