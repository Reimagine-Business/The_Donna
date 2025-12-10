'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { type Entry } from '@/lib/entries'
import { type CustomerGroup } from './pending-collections-dashboard'
import { createSettlement } from '@/app/settlements/actions'
import { showSuccess, showError } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface CustomerSettlementModalProps {
  customer: CustomerGroup | null
  onClose: () => void
  onSuccess?: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function CustomerSettlementModal({
  customer,
  onClose,
  onSuccess,
}: CustomerSettlementModalProps) {
  const router = useRouter()
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showItems, setShowItems] = useState(false)
  const [amount, setAmount] = useState<number>(0)
  const [settlementDate, setSettlementDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  )
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank'>('Cash')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-select first item if only one exists
  useEffect(() => {
    if (customer && customer.items.length === 1) {
      setSelectedItemId(customer.items[0].id)
    }
  }, [customer])

  // Auto-set full amount when item selected
  useEffect(() => {
    if (selectedItemId && customer) {
      const item = customer.items.find((i) => i.id === selectedItemId)
      if (item) {
        const remaining = item.remaining_amount ?? item.amount
        setAmount(remaining)
      }
    }
  }, [selectedItemId, customer])

  if (!customer) return null

  const selectedItem = customer.items.find((i) => i.id === selectedItemId)
  const selectedItemRemaining = selectedItem
    ? selectedItem.remaining_amount ?? selectedItem.amount
    : 0

  const handleSetHalf = () => {
    if (selectedItem) {
      const remaining = selectedItem.remaining_amount ?? selectedItem.amount
      setAmount(Math.floor(remaining / 2))
    }
  }

  const handleSetFull = () => {
    if (selectedItem) {
      const remaining = selectedItem.remaining_amount ?? selectedItem.amount
      setAmount(remaining)
    }
  }

  const handleConfirmSettlement = async () => {
    if (!selectedItemId) {
      showError('Please select an item to settle')
      return
    }

    if (amount <= 0) {
      showError('Settlement amount must be greater than zero')
      return
    }

    if (amount > selectedItemRemaining) {
      showError(
        `Settlement amount cannot exceed remaining amount (${formatCurrency(selectedItemRemaining)})`
      )
      return
    }

    setIsSubmitting(true)

    try {
      const result = await createSettlement(
        selectedItemId,
        amount,
        settlementDate
      )

      if (result.success) {
        showSuccess(`Successfully settled ${formatCurrency(amount)}!`)
        onSuccess?.()
        onClose()
        router.refresh()
      } else {
        showError(result.error || 'Failed to create settlement')
      }
    } catch (error) {
      console.error('Settlement error:', error)
      showError('An error occurred while processing the settlement')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-2xl bg-background rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b px-6 py-4 z-10">
          <h2 className="text-2xl font-bold">Settle Credit for {customer.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select an item and enter settlement details
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Customer Summary */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{customer.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {customer.itemCount} pending item{customer.itemCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(customer.totalAmount)}
                </p>
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
              </div>
            </div>

            {/* Collapsible Items List */}
            <Collapsible
              open={showItems}
              onOpenChange={setShowItems}
              className="mt-4"
            >
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span>
                    {showItems ? 'Hide Items' : 'Show Items'} ({customer.itemCount})
                  </span>
                  {showItems ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-2">
                {customer.items.map((item) => {
                  const itemRemaining = item.remaining_amount ?? item.amount
                  const isSelected = item.id === selectedItemId

                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="selectedItem"
                        checked={isSelected}
                        onChange={() => setSelectedItemId(item.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <p className="font-medium">
                              {item.category} - {format(new Date(item.entry_date), 'MMM dd, yyyy')}
                            </p>
                            {item.notes && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {item.notes}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(itemRemaining)}</p>
                            <p className="text-xs text-muted-foreground">remaining</p>
                          </div>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Settlement Form */}
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Selected Item</p>
                <p className="font-medium">
                  {selectedItem.category} - {format(new Date(selectedItem.entry_date), 'MMM dd, yyyy')}
                </p>
                <p className="text-lg font-bold text-primary mt-2">
                  Remaining: {formatCurrency(selectedItemRemaining)}
                </p>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount">Settlement Amount</Label>
                <div className="flex gap-2">
                  <Input
                    id="amount"
                    type="number"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    placeholder="Enter amount"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={handleSetHalf}>
                    Half
                  </Button>
                  <Button type="button" variant="outline" onClick={handleSetFull}>
                    Full
                  </Button>
                </div>
                {amount > 0 && amount < selectedItemRemaining && (
                  <p className="text-sm text-muted-foreground">
                    Remaining after settlement: {formatCurrency(selectedItemRemaining - amount)}
                  </p>
                )}
              </div>

              {/* Settlement Date */}
              <div className="space-y-2">
                <Label htmlFor="settlementDate">Settlement Date</Label>
                <Input
                  id="settlementDate"
                  type="date"
                  value={settlementDate}
                  onChange={(e) => setSettlementDate(e.target.value)}
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => setPaymentMethod(value as 'Cash' | 'Bank')}
                >
                  <SelectTrigger id="paymentMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {!selectedItem && customer.items.length > 1 && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Please select an item from the list above to proceed with settlement
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-background border-t px-6 py-4 flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSettlement}
            disabled={!selectedItem || isSubmitting || amount <= 0}
          >
            {isSubmitting ? 'Processing...' : `Confirm Settlement - ${formatCurrency(amount)}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
