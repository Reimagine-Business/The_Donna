'use client'

import { useState, useEffect } from 'react'
import { X, Clock } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { updateEntry, type Entry, type Category, type EntryType, type CategoryType, type PaymentMethodType } from '@/app/entries/actions'
import { showSuccess, showError } from '@/lib/toast'
import {
  validateAmount,
  validateDate,
  validateEntryType,
  validateCategoryType,
  validateNotes,
  validatePaymentMethod
} from '@/lib/validation'

interface EditEntryModalProps {
  entry: Entry
  categories: Category[]
  onSuccess: () => void
  onClose: () => void
}

const ENTRY_TYPES: { value: EntryType; label: string }[] = [
  { value: 'Cash IN', label: 'Cash IN' },
  { value: 'Cash OUT', label: 'Cash OUT' },
  { value: 'Credit', label: 'Credit' },
  { value: 'Advance', label: 'Advance' },
]

const CATEGORIES: { value: CategoryType; label: string }[] = [
  { value: 'Sales', label: 'Sales' },
  { value: 'COGS', label: 'COGS (Cost of Goods Sold)' },
  { value: 'Opex', label: 'Opex (Operating Expenses)' },
  { value: 'Assets', label: 'Assets' },
]

const PAYMENT_METHODS: { value: PaymentMethodType; label: string }[] = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Bank', label: 'Bank Transfer' },
  { value: 'None', label: 'None' },
]

export function EditEntryModal({ entry, categories, onSuccess, onClose }: EditEntryModalProps) {
  const [loading, setLoading] = useState(false)
  // Settlement entries shouldn't be edited - use base type only for regular entries
  const [entryType, setEntryType] = useState<EntryType>(
    entry.is_settlement ? 'Cash IN' : entry.entry_type as EntryType
  )
  const [category, setCategory] = useState<CategoryType>(entry.category)
  const [amount, setAmount] = useState(entry.amount.toString())
  const [entryDate, setEntryDate] = useState(entry.entry_date)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>(entry.payment_method)
  const [notes, setNotes] = useState(entry.notes || '')
  const [settled, setSettled] = useState(entry.settled)

  // Validation errors
  const [errors, setErrors] = useState<{
    entryType?: string
    category?: string
    amount?: string
    entryDate?: string
    paymentMethod?: string
    notes?: string
  }>({})

  // Smart payment method logic based on entry type
  useEffect(() => {
    // Credit entries: Auto-select "None" (not a cash transaction)
    if (entryType === 'Credit') {
      setPaymentMethod('None')
    }

    // Advance entries: Switch to "Cash" if "None" is selected (advance requires cash payment)
    if (entryType === 'Advance' && paymentMethod === 'None') {
      setPaymentMethod('Cash')
    }
  }, [entryType, paymentMethod])

  // Get payment method options based on entry type
  const getPaymentMethodOptions = (): { value: PaymentMethodType; label: string }[] => {
    if (entryType === 'Credit') {
      // Credit: Only show "None" (not a cash transaction)
      return [{ value: 'None', label: 'None (Credit - Not Paid Yet)' }]
    }

    if (entryType === 'Advance') {
      // Advance: Only show Cash and Bank (advance IS a cash transaction)
      return [
        { value: 'Cash', label: 'Cash' },
        { value: 'Bank', label: 'Bank Transfer' }
      ]
    }

    // Cash IN/OUT: Show all options
    return PAYMENT_METHODS
  }

  // Validation handlers
  const handleEntryTypeChange = (newType: EntryType) => {
    setEntryType(newType)
    const validation = validateEntryType(newType)
    setErrors(prev => ({ ...prev, entryType: validation.isValid ? undefined : validation.error }))
  }

  const handleCategoryChange = (newCategory: CategoryType) => {
    setCategory(newCategory)
    const validation = validateCategoryType(newCategory)
    setErrors(prev => ({ ...prev, category: validation.isValid ? undefined : validation.error }))
  }

  const handleAmountChange = (newAmount: string) => {
    setAmount(newAmount)
    const validation = validateAmount(newAmount)
    setErrors(prev => ({ ...prev, amount: validation.isValid ? undefined : validation.error }))
  }

  const handleDateChange = (newDate: string) => {
    setEntryDate(newDate)
    const validation = validateDate(newDate)
    setErrors(prev => ({ ...prev, entryDate: validation.isValid ? undefined : validation.error }))
  }

  const handlePaymentMethodChange = (newMethod: PaymentMethodType) => {
    setPaymentMethod(newMethod)
    const validation = validatePaymentMethod(newMethod)
    setErrors(prev => ({ ...prev, paymentMethod: validation.isValid ? undefined : validation.error }))
  }

  const handleNotesChange = (newNotes: string) => {
    setNotes(newNotes)
    const validation = validateNotes(newNotes)
    setErrors(prev => ({ ...prev, notes: validation.isValid ? undefined : validation.error }))
  }

  // Check if form is valid
  const isFormValid = () => {
    return (
      !errors.entryType &&
      !errors.category &&
      !errors.amount &&
      !errors.entryDate &&
      !errors.paymentMethod &&
      !errors.notes &&
      entryType &&
      category &&
      amount &&
      entryDate
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Run all validations
    const entryTypeValidation = validateEntryType(entryType)
    const categoryValidation = validateCategoryType(category)
    const amountValidation = validateAmount(amount)
    const dateValidation = validateDate(entryDate)
    const paymentMethodValidation = validatePaymentMethod(paymentMethod)
    const notesValidation = validateNotes(notes)

    // Update errors
    setErrors({
      entryType: entryTypeValidation.isValid ? undefined : entryTypeValidation.error,
      category: categoryValidation.isValid ? undefined : categoryValidation.error,
      amount: amountValidation.isValid ? undefined : amountValidation.error,
      entryDate: dateValidation.isValid ? undefined : dateValidation.error,
      paymentMethod: paymentMethodValidation.isValid ? undefined : paymentMethodValidation.error,
      notes: notesValidation.isValid ? undefined : notesValidation.error,
    })

    // Check if any validation failed
    if (!entryTypeValidation.isValid) {
      showError(entryTypeValidation.error || 'Invalid entry type')
      return
    }
    if (!categoryValidation.isValid) {
      showError(categoryValidation.error || 'Invalid category')
      return
    }
    if (!amountValidation.isValid) {
      showError(amountValidation.error || 'Invalid amount')
      return
    }
    if (!dateValidation.isValid) {
      showError(dateValidation.error || 'Invalid date')
      return
    }
    if (!paymentMethodValidation.isValid) {
      showError(paymentMethodValidation.error || 'Invalid payment method')
      return
    }
    if (!notesValidation.isValid) {
      showError(notesValidation.error || 'Invalid notes')
      return
    }

    setLoading(true)

    try {
      const result = await updateEntry(entry.id, {
        entry_type: entryType,
        category,
        amount: parseFloat(amount),
        entry_date: entryDate,
        payment_method: paymentMethod,
        notes: notes || undefined,
        settled,
      })

      if (result.success) {
        showSuccess('Entry updated successfully!')
        onSuccess()
        onClose()
      } else {
        showError(result.error || 'Failed to update entry')
      }
    } catch (error) {
      showError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl backdrop-blur-[10px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="sticky top-0 p-4 flex justify-between items-center backdrop-blur-[10px]" style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-xl font-semibold text-white">Edit Entry</h2>
            <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
              <Clock className="w-3 h-3" />
              <span>Created {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/[0.08] rounded-full transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-white/50" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Entry Type */}
          <div>
            <label htmlFor="entry-type" className="block text-sm font-medium text-white/70 mb-2">
              Entry Type <span className="text-red-500">*</span>
            </label>
            <select
              id="entry-type"
              value={entryType}
              onChange={(e) => handleEntryTypeChange(e.target.value as EntryType)}
              className="w-full px-3 py-2 bg-white/[0.08] border border-white/[0.15] rounded-lg text-white focus:border-[#8b5cf6] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30"
              disabled={loading}
            >
              {ENTRY_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.entryType && (
              <p className="mt-1 text-sm text-red-500">{errors.entryType}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-white/70 mb-2">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="category"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as CategoryType)}
              className="w-full px-3 py-2 bg-white/[0.08] border border-white/[0.15] rounded-lg text-white focus:border-[#8b5cf6] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30"
              disabled={loading}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-500">{errors.category}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-white/70 mb-2">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 bg-white/[0.08] border border-white/[0.15] rounded-lg text-white focus:border-[#8b5cf6] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30"
              disabled={loading}
            />
            {errors.amount && (
              <p className="mt-1 text-sm text-red-500">{errors.amount}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label htmlFor="entry-date" className="block text-sm font-medium text-white/70 mb-2">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              id="entry-date"
              type="date"
              value={entryDate}
              onChange={(e) => handleDateChange(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-3 py-2 bg-white/[0.08] border border-white/[0.15] rounded-lg text-white focus:border-[#8b5cf6] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30"
              disabled={loading}
            />
            {errors.entryDate && (
              <p className="mt-1 text-sm text-red-500">{errors.entryDate}</p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label htmlFor="payment-method" className="block text-sm font-medium text-white/70 mb-2">
              Payment Method
            </label>
            <select
              id="payment-method"
              value={paymentMethod}
              onChange={(e) => handlePaymentMethodChange(e.target.value as PaymentMethodType)}
              className="w-full px-3 py-2 bg-white/[0.08] border border-white/[0.15] rounded-lg text-white focus:border-[#8b5cf6] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || entryType === 'Credit'}
            >
              {getPaymentMethodOptions().map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
            {errors.paymentMethod && (
              <p className="mt-1 text-sm text-red-500">{errors.paymentMethod}</p>
            )}

            {/* Helper text for Credit entries */}
            {entryType === 'Credit' && (
              <p className="mt-1 text-xs text-[#8b5cf6]">
                💡 Credit transactions don't require payment method - money not exchanged yet
              </p>
            )}

            {/* Helper text for Advance entries */}
            {entryType === 'Advance' && (
              <p className="mt-1 text-xs text-[#8b5cf6]">
                💡 Advance requires actual payment (Cash or Bank Transfer)
              </p>
            )}
          </div>

          {/* Settled checkbox (for Credit and Advance) */}
          {(entryType === 'Credit' || entryType === 'Advance') && (
            <div>
              <label className="flex items-center space-x-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={settled}
                  onChange={(e) => setSettled(e.target.checked)}
                  className="w-4 h-4 bg-white/[0.08] border border-white/[0.15] rounded focus:ring-2 focus:ring-[#8b5cf6]"
                  disabled={loading}
                />
                <span>Mark as settled</span>
              </label>
            </div>
          )}

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-white/70 mb-2">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              rows={3}
              placeholder="Additional notes (optional)"
              className="w-full px-3 py-2 bg-white/[0.08] border border-white/[0.15] rounded-lg text-white focus:border-[#8b5cf6] focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30 resize-none"
              disabled={loading}
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-red-500">{errors.notes}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.15] text-white rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid() || loading}
              className="flex-1 px-4 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-white/[0.08] disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {loading ? 'Updating...' : 'Update Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
