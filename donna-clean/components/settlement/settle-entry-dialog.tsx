"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { settleEntry } from "@/app/daily-entries/actions";
import { Entry, PAYMENT_METHODS, type PaymentMethod } from "@/lib/entries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SettleEntryDialogProps = {
  entry: Entry | null;
  onClose: () => void;
};

export function SettleEntryDialog({ entry, onClose }: SettleEntryDialogProps) {
  const router = useRouter();
  const [settlementDate, setSettlementDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entry) {
      setSettlementDate(format(new Date(), "yyyy-MM-dd"));
      const remaining = entry.remaining_amount ?? entry.amount;
      setAmount(remaining.toString());
      setError(null);
      const nextMethod: PaymentMethod =
        entry.entry_type === "Credit"
          ? (entry.payment_method === "Cash" || entry.payment_method === "Bank"
              ? entry.payment_method
              : "Cash")
          : "None";
      setPaymentMethod(nextMethod);
    }
  }, [entry]);

  if (!entry) return null;

  const remainingAmount = entry.remaining_amount ?? entry.amount;
  const maxAmount = remainingAmount;
  const isCredit = entry.entry_type === "Credit";
  const isAdvance = entry.entry_type === "Advance";
  const canSettle = isCredit || isAdvance;

  const modalTitle = isCredit && entry.category === "Sales"
    ? "Settle Collection - Cash Inflow"
    : isCredit
      ? "Settle Bill - Cash Outflow"
      : "Recognise Advance - Accrual Only";

    const handleConfirm = async () => {
    if (!canSettle) {
      setError("Only Credit and Advance entries can be settled");
      return;
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0 || numericAmount > maxAmount) {
      setError("Enter a valid amount that does not exceed the remaining balance.");
      return;
    }

      setIsSaving(true);
      setError(null);

      try {
        const result = await settleEntry({
          entryId: entry.id,
          amount: numericAmount,
          settlementDate,
          paymentMethod: isCredit ? paymentMethod : "None",
        });

        if (result?.error) {
          setError(result.error);
          if (result.error.toLowerCase().includes("login")) {
            router.push("/auth/login");
          }
          return;
        }

        router.refresh();
        onClose();
      } catch (err) {
        console.error("Settlement failed", err);
        setError(err instanceof Error ? err.message : "Unable to settle entry.");
      } finally {
        setIsSaving(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Settle Entry</p>
          <h3 className="text-2xl font-semibold text-white">{modalTitle}</h3>
          <p className="text-sm text-slate-400">
            Category: <span className="text-white">{entry.category}</span> · Amount:{" "}
            <span className="text-white">₹{entry.amount.toLocaleString("en-IN")}</span>
          </p>
          {entry.remaining_amount !== undefined && entry.remaining_amount !== entry.amount && (
            <p className="text-xs text-slate-500">
              Remaining: ₹{remainingAmount.toLocaleString("en-IN")}
            </p>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase text-slate-400">Settlement date</Label>
            <Input
              type="date"
              value={settlementDate}
              max={format(new Date(), "yyyy-MM-dd")}
              onChange={(e) => setSettlementDate(e.target.value)}
              className="border-white/10 bg-slate-900 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-slate-400">Amount</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-white/10 bg-slate-900 text-white"
            />
          </div>

            {isCredit && (
              <div className="space-y-2">
                <Label className="text-xs uppercase text-slate-400">Payment method</Label>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#a78bfa]"
                >
                  {(PAYMENT_METHODS as readonly PaymentMethod[]).map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            )}

          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-300 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSaving}
            className="bg-[#a78bfa] text-white hover:bg-[#9770ff]"
          >
            {isSaving ? "Settling..." : "Confirm"}
          </Button>
        </div>
      </div>
    </div>
  );
}
