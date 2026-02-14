"use client";

import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { MoreVertical, Edit2, Trash2, Eye } from "lucide-react";
import { type Entry, type Category } from "@/app/entries/actions";
import { EditEntryModal } from "./edit-entry-modal";
import { DeleteEntryDialog } from "./delete-entry-dialog";
import { EntryDetailsModal } from "./entry-details-modal";

interface EntryListProps {
  entries: Entry[];
  categories: Category[];
  onRefresh: () => void;
}

interface MenuPosition {
  top: number;
  left: number;
}

export function EntryList({ entries, categories, onRefresh }: EntryListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<Entry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<Entry | null>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const handleCloseMenu = () => setOpenMenuId(null);

  const handleOpenMenu = (entryId: string) => {
    const button = buttonRefs.current[entryId];
    if (button) {
      const rect = button.getBoundingClientRect();
      const menuWidth = 192; // w-48 = 12rem = 192px
      const menuHeight = 156; // Actual height: 3 items × 52px = 156px
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Calculate horizontal position - align menu to right edge of button
      let left = rect.right - menuWidth;

      // Ensure menu doesn't go off screen on the left
      if (left < 8) {
        left = 8; // 8px from left edge
      }

      // Ensure menu doesn't go off screen on the right
      if (left + menuWidth > viewportWidth - 8) {
        left = viewportWidth - menuWidth - 8; // 8px from right edge
      }

      // Calculate vertical position
      // Start by centering menu vertically on the button
      let top = rect.top + (rect.height / 2) - (menuHeight / 2);

      // Check if menu would go off bottom of viewport
      if (top + menuHeight > viewportHeight - 20) {
        // Position it to end at bottom with 20px margin
        top = viewportHeight - menuHeight - 20;
      }

      // Check if menu would go off top of viewport
      if (top < 20) {
        top = 20; // 20px from top
      }

      setMenuPosition({ top, left });
      setOpenMenuId(entryId);
    }
  };

  const handleEdit = (entry: Entry) => {
    setEditingEntry(entry);
    handleCloseMenu();
  };

  const handleDelete = (entry: Entry) => {
    setDeletingEntry(entry);
    handleCloseMenu();
  };

  const handleView = (entry: Entry) => {
    setViewingEntry(entry);
    handleCloseMenu();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getEntryTypeColor = (type: string) => {
    switch (type) {
      case "Cash IN":
        return "text-[#10b981] bg-[rgba(16,185,129,0.15)] border-transparent";
      case "Cash OUT":
        return "text-[#ef4444] bg-[rgba(239,68,68,0.15)] border-transparent";
      case "Credit":
        return "text-[#60a5fa] bg-[rgba(96,165,250,0.15)] border-transparent";
      case "Advance":
        return "text-[#a78bfa] bg-[rgba(167,139,250,0.15)] border-transparent";
      case "Credit Settlement (Collections)":
        return "text-[#34d399] bg-[rgba(52,211,153,0.15)] border-transparent";
      case "Credit Settlement (Bills)":
        return "text-[#fb923c] bg-[rgba(251,146,60,0.15)] border-transparent";
      case "Advance Settlement (Received)":
        return "text-[#2dd4bf] bg-[rgba(45,212,191,0.15)] border-transparent";
      case "Advance Settlement (Paid)":
        return "text-[#fbbf24] bg-[rgba(251,191,36,0.15)] border-transparent";
      default:
        return "text-white/70 bg-white/[0.08] border-transparent";
    }
  };

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl p-8 overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(59,7,100,0.5), rgba(15,15,35,0.8))', border: '1px solid rgba(192,132,252,0.15)', borderRadius: '16px' }}>
        <div className="text-center py-8">
          <p className="text-white/50">No entries found for selected period</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card Layout */}
      <div className="md:hidden flex flex-col gap-2">
        {entries.map((entry) => {
          const isIncome =
            entry.entry_type === "Cash IN" ||
            (entry.entry_type === "Credit" && entry.category === "Sales") ||
            (entry.entry_type === "Advance" && entry.category === "Sales");
          const isMenuOpen = openMenuId === entry.id;
          const formattedAmount = entry.amount.toLocaleString("en-IN");

          return (
            <div
              key={entry.id}
              className="rounded-2xl px-4 py-3"
              style={{
                background: 'linear-gradient(135deg, rgba(59,7,100,0.5), rgba(15,15,35,0.8))',
                border: '1px solid rgba(192,132,252,0.15)',
                borderRadius: '16px',
              }}
            >
              {/* Top row: Date | Type badge | Amount */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-semibold text-white whitespace-nowrap">
                  {format(new Date(entry.entry_date), "dd MMM")}
                </span>

                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium border shrink-0 ${getEntryTypeColor(
                    entry.entry_type
                  )}`}
                >
                  {entry.entry_type}
                  {entry.is_settlement && (
                    <span className="ml-1 text-[11px] text-white/50" title="Settlement">⚡</span>
                  )}
                </span>

                <span
                  className={`text-[16px] font-bold whitespace-nowrap ${
                    isIncome ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isIncome ? "₹" : "-₹"}{formattedAmount}
                </span>
              </div>

              {/* Bottom row: Category • Payment • Party | Action button */}
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[12px] text-white/60 truncate">
                  {entry.category}
                  {entry.payment_method ? ` · ${entry.payment_method}` : ""}
                  {entry.party?.name ? ` · ${entry.party.name}` : ""}
                </span>

                <button
                  ref={(el) => { buttonRefs.current[entry.id] = el; }}
                  onClick={() =>
                    isMenuOpen ? handleCloseMenu() : handleOpenMenu(entry.id)
                  }
                  className="p-3 -mr-2 hover:bg-white/[0.08] text-white/50 rounded-lg transition-colors shrink-0"
                  title="Actions"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table Layout - Hidden on Mobile */}
      <div className="hidden md:block rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(59,7,100,0.5), rgba(15,15,35,0.8))', border: '1px solid rgba(192,132,252,0.15)', borderRadius: '16px' }}>
        {/* Table Header - Fixed Width Columns */}
        <div className="grid grid-cols-[80px_120px_140px_110px_1fr_100px_50px] gap-4 px-4 py-3 font-medium text-sm uppercase tracking-wide text-white/70" style={{ background: 'rgba(139,92,246,0.15)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-left">DATE</div>
          <div className="text-left">ENTRY TYPE</div>
          <div className="text-left">PARTY</div>
          <div className="text-left">CATEGORY</div>
          <div className="text-right">AMOUNT</div>
          <div className="text-left">PAYMENT</div>
          <div></div>
        </div>

        {/* Table Body - Matching Column Widths */}
        <div className="divide-y divide-white/[0.06]">
          {entries.map((entry) => {
            const isIncome =
              entry.entry_type === "Cash IN" ||
              (entry.entry_type === "Credit" && entry.category === "Sales") ||
              (entry.entry_type === "Advance" && entry.category === "Sales");
            const isMenuOpen = openMenuId === entry.id;

            return (
              <div
                key={entry.id}
                className="grid grid-cols-[80px_120px_140px_110px_1fr_100px_50px] gap-4 px-4 py-4 hover:bg-white/[0.03] transition-colors items-center"
              >
                {/* Date - Fixed 80px */}
                <div className="flex flex-col text-sm">
                  <span className="font-medium text-white text-base">
                    {format(new Date(entry.entry_date), "dd")}
                  </span>
                  <span className="text-white/50 text-xs">
                    {format(new Date(entry.entry_date), "MMM")}
                  </span>
                </div>

                {/* Entry Type - Fixed 120px */}
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${getEntryTypeColor(
                      entry.entry_type
                    )}`}
                  >
                    {entry.entry_type}
                  </span>
                  {entry.is_settlement && (
                    <span className="text-xs text-white/50" title="Settlement Entry">
                      ⚡
                    </span>
                  )}
                </div>

                {/* Party - Fixed 140px */}
                <div className="text-sm text-white/50 truncate">
                  {entry.party?.name || "-"}
                </div>

                {/* Category - Fixed 110px */}
                <div className="text-sm text-white">{entry.category}</div>

                {/* Amount - Flex (takes remaining space, right-aligned) */}
                <div
                  className={`text-right font-medium text-base ${
                    isIncome ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {isIncome ? "+ " : "- "}
                  {formatCurrency(entry.amount)}
                </div>

                {/* Payment Method - Fixed 110px */}
                <div className="text-sm">
                  {entry.payment_method && (
                    <span className="inline-flex items-center px-3 py-1 rounded-lg bg-white/[0.08] text-white/70 text-xs border border-white/[0.15] whitespace-nowrap">
                      {entry.payment_method}
                    </span>
                  )}
                </div>

                {/* Actions Menu - Fixed 50px */}
                <div className="flex items-center justify-end">
                  <button
                    ref={(el) => { buttonRefs.current[entry.id] = el; }}
                    onClick={() =>
                      isMenuOpen ? handleCloseMenu() : handleOpenMenu(entry.id)
                    }
                    className="p-3 hover:bg-white/[0.08] rounded-md transition-colors text-white/50"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed Position Dropdown Menu */}
      {openMenuId && (
        <>
          {/* Backdrop to close menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={handleCloseMenu}
          />

          {/* Menu - Fixed position, won't be clipped by overflow containers */}
          <div
            className="fixed z-50 w-48 rounded-xl shadow-xl overflow-hidden backdrop-blur-[10px]"
            style={{
              ...{
                top: `${menuPosition.top}px`,
                left: `${menuPosition.left}px`,
              },
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <button
              onClick={() => {
                const entry = entries.find(e => e.id === openMenuId);
                if (entry) handleView(entry);
              }}
              className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/[0.05] transition-colors flex items-center gap-3"
            >
              <Eye className="w-4 h-4" />
              View Details
            </button>
            <button
              onClick={() => {
                const entry = entries.find(e => e.id === openMenuId);
                if (entry) handleEdit(entry);
              }}
              className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/[0.05] transition-colors flex items-center gap-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Edit2 className="w-4 h-4" />
              Edit Entry
            </button>
            <button
              onClick={() => {
                const entry = entries.find(e => e.id === openMenuId);
                if (entry) handleDelete(entry);
              }}
              className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Trash2 className="w-4 h-4" />
              Delete Entry
            </button>
          </div>
        </>
      )}

      {/* Modals */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          categories={categories}
          onSuccess={onRefresh}
          onClose={() => setEditingEntry(null)}
        />
      )}

      {deletingEntry && (
        <DeleteEntryDialog
          entry={deletingEntry}
          categories={categories}
          onSuccess={onRefresh}
          onClose={() => setDeletingEntry(null)}
        />
      )}

      {viewingEntry && (
        <EntryDetailsModal
          entry={viewingEntry}
          categories={categories}
          onEdit={() => setEditingEntry(viewingEntry)}
          onDelete={() => setDeletingEntry(viewingEntry)}
          onClose={() => setViewingEntry(null)}
        />
      )}
    </>
  );
}
