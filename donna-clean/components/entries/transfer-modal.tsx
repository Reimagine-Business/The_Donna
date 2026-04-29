'use client'

import { useState } from 'react'
import { X, ArrowLeftRight, AlertTriangle, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { createEntry } from '@/app/entries/actions'
import { validateAmount, validateDate, validateNotes } from '@/lib/validation'
import { showSuccess, showError } from '@/lib/toast'

interface TransferModalProps {
  cashBalance: number
  onClose: () => void
  onSuccess: () => void
}

type TransferAccount = 'Cash' | 'Bank'

export function TransferModal({ cashBalance, onClose, onSuccess }: TransferModalProps) {
  const [from, setFrom] = useState<TransferAccount>('Cash')
  const [to, setTo] = useState<TransferAccount>('Bank')
  const [amount, setAmount] = useState('')
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ amount?: string; date?: string; notes?: string; general?: string }>({})

  const parsedAmount = parseFloat(amount) || 0
  // Soft warning: Cash → Bank transfer exceeds current cash balance
  const showCashWarning = from === 'Cash' && parsedAmount > 0 && parsedAmount > cashBalance

  function handleFromChange(account: TransferAccount) {
    setFrom(account)
    // Auto-flip "to" if it matches "from"
    if (account === to) {
      setTo(account === 'Cash' ? 'Bank' : 'Cash')
    }
  }

  function handleToChange(account: TransferAccount) {
    setTo(account)
    if (account === from) {
      setFrom(account === 'Cash' ? 'Bank' : 'Cash')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const numAmount = parseFloat(amount)
    const amountCheck = validateAmount(numAmount)
    if (!amountCheck.isValid) { setErrors(p => ({ ...p, amount: amountCheck.error })); return }

    const dateCheck = validateDate(entryDate)
    if (!dateCheck.isValid) { setErrors(p => ({ ...p, date: dateCheck.error })); return }

    const notesCheck = validateNotes(notes || undefined)
    if (!notesCheck.isValid) { setErrors(p => ({ ...p, notes: notesCheck.error })); return }

    if (from === to) {
      setErrors({ general: 'Source and destination cannot be the same account' })
      return
    }

    setLoading(true)
    const result = await createEntry({
      entry_type: 'transfer',
      category: null,
      amount: numAmount,
      entry_date: entryDate,
      payment_method: from,
      transfer_to: to,
      notes: notes.trim() || undefined,
      settled: false,
    })
    setLoading(false)

    if (result.success) {
      showSuccess(`Transfer of ₹${numAmount.toLocaleString('en-IN')} recorded`)
      onSuccess()
    } else {
      showError(result.error ?? 'Failed to record transfer')
      setErrors({ general: result.error ?? 'Failed to record transfer' })
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-md rounded-2xl p-6 pointer-events-auto"
          style={{
            background: 'linear-gradient(135deg, rgba(59,7,100,0.95), rgba(15,15,35,0.98))',
            border: '1px solid rgba(192,132,252,0.3)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-[#8b5cf6]" />
              <h2 className="text-lg font-semibold text-white">Record Transfer</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-white/50 mb-5">
            Move money between your Cash and Bank accounts. Transfers don't affect profit or income totals.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Transfer From / To */}
            <div className="grid grid-cols-2 gap-3">
              {/* From */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                  Transfer From
                </label>
                <div className="flex flex-col gap-1.5">
                  {(['Cash', 'Bank'] as TransferAccount[]).map(account => (
                    <button
                      key={account}
                      type="button"
                      onClick={() => handleFromChange(account)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                        from === account
                          ? 'bg-[#8b5cf6] text-white'
                          : 'bg-white/[0.08] text-white/70 hover:bg-white/[0.12]'
                      }`}
                    >
                      {account}
                    </button>
                  ))}
                </div>
              </div>

              {/* To */}
              <div>
                <label className="block text-xs font-medium text-white/60 mb-2 uppercase tracking-wide">
                  Transfer To
                </label>
                <div className="flex flex-col gap-1.5">
                  {(['Cash', 'Bank'] as TransferAccount[]).map(account => (
                    <button
                      key={account}
                      type="button"
                      onClick={() => handleToChange(account)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                        to === account
                          ? 'bg-[#8b5cf6] text-white'
                          : 'bg-white/[0.08] text-white/70 hover:bg-white/[0.12]'
                      }`}
                    >
                      {account}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Direction summary */}
            <div className="flex items-center justify-center gap-2 py-1">
              <span className="px-3 py-1 text-xs rounded-full bg-white/[0.08] text-white/60">{from}</span>
              <ArrowLeftRight className="w-4 h-4 text-[#8b5cf6]" />
              <span className="px-3 py-1 text-xs rounded-full bg-white/[0.08] text-white/60">{to}</span>
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="transfer-amount" className="block text-sm font-medium text-white/70 mb-1.5">
                Amount *
              </label>
              <input
                id="transfer-amount"
                type="number"
                value={amount}
                onChange={e => { setAmount(e.target.value); setErrors(p => ({ ...p, amount: undefined })) }}
                className="w-full px-4 py-2.5 bg-white/[0.08] border border-white/[0.15] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6]/30"
                placeholder="0"
                min="0.01"
                step="0.01"
                required
                disabled={loading}
              />
              {errors.amount && <p className="text-xs text-red-400 mt-1">{errors.amount}</p>}
            </div>

            {/* Cash balance warning (soft) */}
            {showCashWarning && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300">
                  Heads up: this is more than your current cash balance (₹{cashBalance.toLocaleString('en-IN')}). You can still continue.
                </p>
              </div>
            )}

            {/* Date */}
            <div>
              <label htmlFor="transfer-date" className="block text-sm font-medium text-white/70 mb-1.5">
                Date *
              </label>
              <input
                id="transfer-date"
                type="date"
                value={entryDate}
                max={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => { setEntryDate(e.target.value); setErrors(p => ({ ...p, date: undefined })) }}
                className="w-full px-4 py-2.5 bg-white/[0.08] border border-white/[0.15] rounded-lg text-white focus:outline-none focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6]/30"
                required
                disabled={loading}
              />
              {errors.date && <p className="text-xs text-red-400 mt-1">{errors.date}</p>}
            </div>

            {/* Note */}
            <div>
              <label htmlFor="transfer-notes" className="block text-sm font-medium text-white/70 mb-1.5">
                Note <span className="text-white/40">(optional)</span>
              </label>
              <textarea
                id="transfer-notes"
                value={notes}
                onChange={e => { setNotes(e.target.value); setErrors(p => ({ ...p, notes: undefined })) }}
                className="w-full px-4 py-2.5 bg-white/[0.08] border border-white/[0.15] rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6]/30 resize-none"
                placeholder="e.g. Weekly cash deposit"
                rows={2}
                maxLength={500}
                disabled={loading}
              />
              {errors.notes && <p className="text-xs text-red-400 mt-1">{errors.notes}</p>}
            </div>

            {/* General error */}
            {errors.general && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {errors.general}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-white/[0.08] text-white/70 hover:bg-white/[0.12] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Record Transfer'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
