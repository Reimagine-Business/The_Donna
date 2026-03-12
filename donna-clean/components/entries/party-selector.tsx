"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Check, Pencil, Trash2 } from "lucide-react";
import { getParties, createParty, getPartiesWithBalance, updateParty, deleteParty } from "@/app/parties/actions";
import type { Party, PartyType } from "@/lib/parties";
import { filterPartiesByType, getRequiredPartyType } from "@/lib/parties";
import { showSuccess, showError } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PartySelectorProps {
  entryType: string;
  category: string;
  value?: string;
  onChange: (partyId: string | undefined) => void;
  required?: boolean; // NEW: Whether party selection is required
}

// ─── Types used by the Manage Parties modal ─────────────────────────────────

type PartyWithPending = Party & { pending_amount: number };

// ─── Manage Parties Modal ────────────────────────────────────────────────────

interface ManagePartiesModalProps {
  open: boolean;
  initialTab: "Customer" | "Vendor";
  onClose: () => void;
  /** Called after a rename so the selector list stays fresh */
  onPartiesChanged: () => void;
}

function ManagePartiesModal({
  open,
  initialTab,
  onClose,
  onPartiesChanged,
}: ManagePartiesModalProps) {
  const [activeTab, setActiveTab] = useState<"Customer" | "Vendor">(initialTab);
  const [parties, setParties] = useState<PartyWithPending[]>([]);
  const [loading, setLoading] = useState(false);

  // Per-row state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadParties = useCallback(async () => {
    setLoading(true);
    const result = await getPartiesWithBalance();
    if (result.success && result.parties) {
      setParties(result.parties);
    }
    setLoading(false);
  }, []);

  // Reset tab when modal opens
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      loadParties();
    }
  }, [open, initialTab, loadParties]);

  function startEdit(party: PartyWithPending) {
    setEditingId(party.id);
    setEditName(party.name);
    setConfirmDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function saveEdit(party: PartyWithPending) {
    if (!editName.trim()) {
      showError("Name cannot be empty");
      return;
    }
    if (editName.trim() === party.name) {
      cancelEdit();
      return;
    }
    setSavingId(party.id);
    const result = await updateParty(party.id, { name: editName.trim() });
    setSavingId(null);
    if (result.success) {
      setParties((prev) =>
        prev.map((p) => (p.id === party.id ? { ...p, name: editName.trim() } : p))
      );
      setEditingId(null);
      setEditName("");
      showSuccess("Party renamed successfully");
      onPartiesChanged();
    } else {
      showError(result.error ?? "Failed to rename party");
    }
  }

  function startDelete(party: PartyWithPending) {
    if (party.pending_amount > 0) return; // blocked
    setConfirmDeleteId(party.id);
    setEditingId(null);
  }

  function cancelDelete() {
    setConfirmDeleteId(null);
  }

  async function confirmDelete(partyId: string) {
    setDeletingId(partyId);
    const result = await deleteParty(partyId);
    setDeletingId(null);
    if (result.success) {
      setParties((prev) => prev.filter((p) => p.id !== partyId));
      setConfirmDeleteId(null);
      showSuccess("Party deleted");
      onPartiesChanged();
    } else {
      showError(result.error ?? "Failed to delete party");
    }
  }

  const tabParties = parties.filter(
    (p) => p.party_type === activeTab || p.party_type === "Both"
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#1a1a2e] border border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white text-lg font-semibold">
            Manage Parties
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-white/[0.06] p-1 mb-4">
          {(["Customer", "Vendor"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setEditingId(null);
                setConfirmDeleteId(null);
              }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-[#8b5cf6] text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {tab === "Customer" ? "Customers" : "Vendors"}
            </button>
          ))}
        </div>

        {/* Party list */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {loading ? (
            <p className="text-white/40 text-sm text-center py-6">Loading…</p>
          ) : tabParties.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-6">
              No {activeTab.toLowerCase()}s yet.
            </p>
          ) : (
            tabParties.map((party) => {
              const isEditing = editingId === party.id;
              const isConfirmDelete = confirmDeleteId === party.id;
              const isSaving = savingId === party.id;
              const isDeleting = deletingId === party.id;
              const hasPending = party.pending_amount > 0;

              return (
                <div
                  key={party.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08]"
                >
                  {/* Name / edit input */}
                  {isEditing ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(party);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="flex-1 bg-white/[0.08] border border-[#8b5cf6]/60 rounded px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/40"
                      autoFocus
                      disabled={isSaving}
                    />
                  ) : isConfirmDelete ? (
                    <span className="flex-1 text-sm text-red-400">
                      Delete &ldquo;{party.name}&rdquo;? This cannot be undone.
                    </span>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-white truncate block">
                        {party.name}
                      </span>
                      {hasPending ? (
                        <span className="text-xs text-amber-400">
                          ₹{party.pending_amount.toLocaleString()} pending
                        </span>
                      ) : (
                        <span className="text-xs text-white/30">No pending</span>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  {isEditing ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => saveEdit(party)}
                        disabled={isSaving}
                        className="p-1.5 rounded bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:opacity-50 text-white transition-colors"
                        title="Save"
                      >
                        {isSaving ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isSaving}
                        className="p-1.5 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white/60 transition-colors"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : isConfirmDelete ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => confirmDelete(party.id)}
                        disabled={isDeleting}
                        className="px-2 py-1 rounded bg-red-500/80 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                      >
                        {isDeleting ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelDelete}
                        disabled={isDeleting}
                        className="px-2 py-1 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white/60 text-xs transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(party)}
                        className="p-1.5 rounded hover:bg-white/[0.10] text-white/50 hover:text-white transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startDelete(party)}
                        disabled={hasPending}
                        className={`p-1.5 rounded transition-colors ${
                          hasPending
                            ? "text-white/20 cursor-not-allowed"
                            : "hover:bg-red-500/20 text-white/50 hover:text-red-400"
                        }`}
                        title={
                          hasPending
                            ? "Cannot delete: party has pending amount"
                            : "Delete"
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main PartySelector component ───────────────────────────────────────────

/**
 * PartySelector - Smart party (customer/vendor) selection component
 *
 * Shows party selection field for:
 * - Credit/Advance entries (REQUIRED)
 * - Cash IN/OUT entries (OPTIONAL)
 *
 * Automatically filters parties based on entry type:
 * - Cash IN / Credit Sales / Advance Received → Shows Customers
 * - Cash OUT / Credit Purchases / Advance Paid → Shows Vendors
 *
 * Allows inline creation of new parties without leaving the form.
 */
export function PartySelector({
  entryType,
  category,
  value,
  onChange,
  required = false // Default to optional (for backward compatibility)
}: PartySelectorProps) {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPartyInput, setShowNewPartyInput] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyMobile, setNewPartyMobile] = useState("");
  const [creating, setCreating] = useState(false);

  // Manage Parties modal state
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageModalTab, setManageModalTab] = useState<"Customer" | "Vendor">("Customer");

  // Determine if party field should be shown and what type
  // For Credit/Advance, use the existing helper function
  // For Cash IN/OUT, determine type based on entry type
  const getPartyType = (): PartyType | null => {
    // Credit and Advance - use existing logic
    const creditAdvanceType = getRequiredPartyType(entryType, category);
    if (creditAdvanceType) return creditAdvanceType;

    // Cash IN → Customer
    if (entryType === "Cash IN") return "Customer";

    // Cash OUT → Vendor
    if (entryType === "Cash OUT") return "Vendor";

    return null;
  };

  const partyType = getPartyType();
  const shouldShow = partyType !== null;

  useEffect(() => {
    loadParties();
  }, []);

  async function loadParties() {
    setLoading(true);
    const result = await getParties();
    if (result.success && result.parties) {
      setParties(result.parties);
    }
    setLoading(false);
  }

  async function handleCreateParty() {
    if (!newPartyName.trim()) {
      showError("Please enter a party name");
      return;
    }

    if (!partyType) return;

    setCreating(true);

    const result = await createParty({
      name: newPartyName.trim(),
      mobile: newPartyMobile.trim() || undefined,
      party_type: partyType,
    });

    setCreating(false);

    if (result.success && result.party) {
      // Add new party to the list
      setParties([...parties, result.party]);

      // Select the newly created party
      onChange(result.party.id);

      // Reset form
      setShowNewPartyInput(false);
      setNewPartyName("");
      setNewPartyMobile("");

      showSuccess(`${partyType} "${result.party.name}" created successfully`);
    } else {
      showError(result.error || "Failed to create party");
    }
  }

  function handleCancel() {
    setShowNewPartyInput(false);
    setNewPartyName("");
    setNewPartyMobile("");
  }

  function openManageModal(tab: "Customer" | "Vendor") {
    setManageModalTab(tab);
    setShowManageModal(true);
  }

  // Don't show if party type cannot be determined
  if (!shouldShow || !partyType) {
    return null;
  }

  // Filter parties based on required type
  const filteredParties = filterPartiesByType(parties, partyType);

  const partyLabel = partyType === 'Customer' ? 'CUSTOMER' : 'VENDOR';

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-white/70">
        {partyLabel} {required && <span className="text-red-400">*</span>}
        {!required && <span className="text-white/60 ml-2">(Optional)</span>}
      </label>

      {!showNewPartyInput ? (
        /* ========== PARTY SELECTION DROPDOWN ========== */
        <div className="relative">
          <select
            value={value || ""}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                setShowNewPartyInput(true);
              } else if (e.target.value === "__manage__") {
                // Reset select to previous value; open modal
                openManageModal(partyType as "Customer" | "Vendor");
              } else {
                onChange(e.target.value || undefined);
              }
            }}
            className="w-full px-4 py-2.5 rounded-lg bg-white/[0.08] border border-white/[0.15] text-white focus:border-[#8b5cf6] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30 transition-colors"
            required={required}
            disabled={loading}
          >
            {/* Different placeholder based on required/optional */}
            <option value="">
              {loading
                ? "Loading parties..."
                : required
                  ? `Select ${partyLabel.toLowerCase()}...`
                  : `— Skip (No ${partyLabel.toLowerCase()}) —`
              }
            </option>

            {filteredParties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.name}
                {party.mobile ? ` (${party.mobile})` : ""}
              </option>
            ))}

            <option value="__new__" className="font-semibold text-white/50">
              + Add new {partyLabel.toLowerCase()}...
            </option>

            <option value="__manage__" className="text-white/50">
              Manage {partyLabel.toLowerCase()}s →
            </option>
          </select>
        </div>
      ) : (
        /* ========== NEW PARTY CREATION FORM ========== */
        <div className="space-y-3 p-4 bg-white/[0.05] border border-white/10 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-white/70">
              Create New {partyLabel}
            </h4>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 text-white/50 hover:text-white transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Party Name Input */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={newPartyName}
              onChange={(e) => setNewPartyName(e.target.value)}
              placeholder={`Enter ${partyLabel.toLowerCase()} name...`}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.08] border border-white/[0.15] text-white placeholder:text-white/30 focus:border-[#8b5cf6] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30"
              autoFocus
              disabled={creating}
            />
          </div>

          {/* Party Mobile Input (Optional) */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">
              Mobile (optional)
            </label>
            <input
              type="tel"
              value={newPartyMobile}
              onChange={(e) => setNewPartyMobile(e.target.value)}
              placeholder="Enter mobile number..."
              className="w-full px-3 py-2 rounded-lg bg-white/[0.08] border border-white/[0.15] text-white placeholder:text-white/30 focus:border-[#8b5cf6] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30"
              disabled={creating}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleCreateParty}
              disabled={creating || !newPartyName.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-[#8b5cf6]/50 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={creating}
              className="px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.15] disabled:bg-white/[0.05] text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Helper Text */}
      <p className="text-xs text-[#8b5cf6]">
        {required ? (
          partyType === 'Customer'
            ? "Select or create a customer for this sale/collection"
            : "Select or create a vendor for this purchase/payment"
        ) : (
          partyType === 'Customer'
            ? "Optionally link this entry to a customer"
            : "Optionally link this entry to a vendor"
        )}
      </p>

      {/* Manage Parties Modal */}
      <ManagePartiesModal
        open={showManageModal}
        initialTab={manageModalTab}
        onClose={() => setShowManageModal(false)}
        onPartiesChanged={loadParties}
      />
    </div>
  );
}
