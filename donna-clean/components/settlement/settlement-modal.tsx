"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { X, Check } from "lucide-react";
import { type Entry } from "@/app/entries/actions";
import { createSettlement } from "@/app/settlements/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { showSuccess, showError } from "@/lib/toast";

type SettlementType = 'credit-sales' | 'credit-bills' | 'advance-sales' | 'advance-expenses';

type SettlementModalProps = {
  type: SettlementType;
  pendingItems: Entry[];
  onClose: () => void;
  onSuccess?: () => void;
};

type SelectedItem = {
  entry: Entry;
  amount: number;
};

export function SettlementModal({ type, pendingItems, onClose, onSuccess }: SettlementModalProps) {
  const router = useRouter();
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [settlementDate, setSettlementDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank'>('Cash');
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const getModalTitle = () => {
    switch (type) {
      case 'credit-sales':
        return 'Settle Credit Sales';
      case 'credit-bills':
        return 'Settle Credit Bills';
      case 'advance-sales':
        return 'Settle Advance Sales';
      case 'advance-expenses':
        return 'Settle Advance Expenses';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'credit-sales':
        return 'Select Credit Sales to collect. This will create Cash IN entries and mark items as settled.';
      case 'credit-bills':
        return 'Select Credit Bills to pay. This will create Cash OUT entries and mark items as settled.';
      case 'advance-sales':
        return 'Select Advance Sales to recognize as revenue. This will NOT create new cash entries (already counted).';
      case 'advance-expenses':
        return 'Select Advance Expenses to recognize. This will NOT create new cash entries (already counted).';
    }
  };

  const handleToggleItem = (entry: Entry, selected: boolean) => {
    const newSelected = new Map(selectedItems);
    if (selected) {
      const remainingAmount = entry.remaining_amount ?? entry.amount;
      newSelected.set(entry.id, { entry, amount: remainingAmount });
    } else {
      newSelected.delete(entry.id);
    }
    setSelectedItems(newSelected);
  };

  const handleAmountChange = (entryId: string, newAmount: string) => {
    const amount = parseFloat(newAmount) || 0;
    const item = selectedItems.get(entryId);
    if (item) {
      const newSelected = new Map(selectedItems);
      newSelected.set(entryId, { ...item, amount });
      setSelectedItems(newSelected);
    }
  };

  const totalAmount = Array.from(selectedItems.values()).reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const handleSettle = async () => {
    if (selectedItems.size === 0) {
      showError("Please select at least one item to settle");
      return;
    }

    setIsSaving(true);

    try {
      const results = await Promise.all(
        Array.from(selectedItems.values()).map(({ entry, amount }) =>
          createSettlement(entry.id, amount, settlementDate)
        )
      );

      const failedCount = results.filter(r => !r.success).length;

      if (failedCount > 0) {
        showError(`${failedCount} item(s) failed to settle. Please check and try again.`);
      } else {
        showSuccess(`${selectedItems.size} item(s) settled successfully!`);
        onSuccess?.();
        onClose();
        router.refresh();
      }
    } catch (error) {
      console.error("Settlement failed:", error);
      showError("Failed to settle items");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 overflow-y-auto py-8">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-2xl font-bold text-white">{getModalTitle()}</h2>
            <p className="text-sm text-muted-foreground mt-1">{getDescription()}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {pendingItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending items to settle
            </div>
          ) : (
            <div className="space-y-3">
              {pendingItems.map((entry) => {
                const remainingAmount = entry.remaining_amount ?? entry.amount;
                const isSelected = selectedItems.has(entry.id);
                const selectedItem = selectedItems.get(entry.id);

                return (
                  <div
                    key={entry.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-border bg-card/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleToggleItem(entry, checked as boolean)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-white">
                                {entry.category}
                              </span>
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                                {entry.entry_type}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Entry Date: {format(new Date(entry.entry_date), 'dd MMM yyyy')}
                            </p>
                            {entry.notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Note: {entry.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-white">
                              ₹{remainingAmount.toLocaleString('en-IN')}
                            </p>
                            {entry.remaining_amount !== entry.amount && (
                              <p className="text-xs text-muted-foreground">
                                of ₹{entry.amount.toLocaleString('en-IN')}
                              </p>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                            <Label className="text-xs text-muted-foreground mb-1">
                              Settlement Amount
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              max={remainingAmount}
                              step="0.01"
                              value={selectedItem?.amount || ''}
                              onChange={(e) => handleAmountChange(entry.id, e.target.value)}
                              className="bg-card border-border text-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Settlement Details */}
        {selectedItems.size > 0 && (
          <div className="p-6 border-t border-border bg-muted/20">
            <h3 className="text-sm font-semibold text-white mb-4">Settlement Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1">Settlement Date</Label>
                <Input
                  type="date"
                  value={settlementDate}
                  max={format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => setSettlementDate(e.target.value)}
                  className="bg-card border-border text-white"
                />
              </div>

              {(type === 'credit-sales' || type === 'credit-bills') && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1">Payment Method</Label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'Cash' | 'Bank')}
                    className="w-full px-3 py-2 bg-card border border-border rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mb-4">
              <Label className="text-xs text-muted-foreground mb-1">Notes (Optional)</Label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes..."
                className="bg-card border-border text-white"
              />
            </div>

            {/* Summary */}
            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Selected Items:</span>
                <span className="text-sm font-semibold text-white">{selectedItems.size}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Amount to Settle:</span>
                <span className="text-lg font-bold text-purple-400">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-6 border-t border-border flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            className="text-foreground/70 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSettle}
            disabled={isSaving || selectedItems.size === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isSaving ? (
              "Settling..."
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Settle Selected ({selectedItems.size})
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
