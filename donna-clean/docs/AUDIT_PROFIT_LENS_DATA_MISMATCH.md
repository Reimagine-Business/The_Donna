# Audit: Profit Lens Data Mismatch

**Date:** 2026-03-01
**Status:** Fixed — home page now uses getEntriesForAnalytics(), balance.ts getCashDelta() aligned

## Problem Statement

The "How is your business doing?" section (Profit Lens on the home page) shows
numbers that do not match what Cash Pulse and the Pending Collections tab show.

Values observed on home page (All Time):

| Metric                  | Home Page Value |
|-------------------------|-----------------|
| What's Yours (Total)    | ₹9,32,448.38   |
| What is Not Yours       | ₹1,537          |
| Your Profit from Sales  | ₹8,96,036.38   |
| Cash in Bank/Hand       | ₹2,69,470.47   |
| Money to Collect        | ₹6,14,223.45   |
| Advances Paid           | ₹0              |
| Fixed Assets            | ₹48,754.46     |
| Bills to Pay            | ₹1,537          |
| Customer Advances       | ₹0              |

vs Cash Pulse Pending Collections tab: **₹7,32,223**

---

## Root Cause

**The home page uses `getRecentEntries()` which only fetches the last 30 days
of entries (max 100 rows).** The "How is your business doing?" section
(`BusinessCards` component) computes balance-sheet metrics from this truncated
dataset, even when the user selects "All Time".

The analytics pages use `getEntriesForAnalytics()` which fetches up to 2 years
of entries (max 5000 rows), producing more complete numbers.

### Data source comparison

| Page           | Server function            | Lookback   | Row cap |
|----------------|----------------------------|------------|---------|
| Home page      | `getRecentEntries()`       | 30 days    | 100     |
| Cash Pulse     | `getEntriesForAnalytics()` | 2 years    | 5000    |
| Profit Lens    | `getEntriesForAnalytics()` | 2 years    | 5000    |

---

## Files Involved

### Home page data flow

```
app/home/page.tsx:34          → getRecentEntries() [30 days, 100 rows]
  ↓
components/home-v2/business-cards.tsx
  ├── calculateCashBalance(entries)        → lib/analytics-new.ts:47
  ├── receivables filter (Credit Sales)    → business-cards.tsx:43-48
  ├── prepaid filter (Advance COGS/Opex)   → business-cards.tsx:51-57
  ├── fixedAssets filter (Assets)          → business-cards.tsx:59-61
  ├── creditBills filter (Credit COGS/Opex)→ business-cards.tsx:65-72
  ├── customerAdvances filter (Adv Sales)  → business-cards.tsx:75-81
  └── getProfitMetrics(entries)            → lib/profit-calculations-new.ts:183
```

### Cash Pulse data flow

```
app/analytics/cashpulse/page.tsx:14   → getEntriesForAnalytics() [2 years, 5000 rows]
  ↓
components/analytics/cash-pulse-analytics.tsx
  ├── calculateCashBalance(entries)        → lib/analytics-new.ts:47
  ├── pendingCollections filter            → cash-pulse-analytics.tsx:212-223
  ├── pendingBills filter                  → cash-pulse-analytics.tsx:226-237
  └── advance filter                       → cash-pulse-analytics.tsx:240-263
```

### Profit Lens analytics data flow

```
app/analytics/profitlens/page.tsx:18  → getEntriesForAnalytics() [2 years, 5000 rows]
  ↓
components/analytics/profit-lens-analytics.tsx
  └── getProfitMetrics(entries)            → lib/profit-calculations-new.ts:183
```

---

## Discrepancy Details

### A) Money to Collect: ₹6,14,223.45 vs ₹7,32,223

- **Home page** (`business-cards.tsx:43-48`):
  `entries.filter(e => e.entry_type === 'Credit' && e.category === 'Sales' && !e.settled)`
  uses `remaining_amount ?? amount`, from 30-day dataset

- **Cash Pulse** (`cash-pulse-analytics.tsx:212-223`):
  Identical filter, from 2-year dataset

- **Difference (~₹1,18,000):** Unsettled Credit Sales older than 30 days present
  in the 2-year dataset but absent from the 30-day home page dataset.

- **Correct value:** ₹7,32,223 (Cash Pulse). Even this could undercount if there
  are unsettled entries older than 2 years.

### B) Cash in Bank/Hand: ₹2,69,470.47

- **File:** `business-cards.tsx:41` → `analytics-new.ts:47-69`
- **Calculation:** `calculateCashBalance(entries)` sums
  `(Cash IN + Credit Settlement Collections + Advance Sales) -
   (Cash OUT + Credit Settlement Bills + Advance COGS/Opex/Assets)`

- **Problem:** Cash balance is a cumulative running total that requires ALL
  entries ever recorded. With only 30 days of data, this shows the net cash
  movement of the last month, not the true balance.

- **Correct value:** Whatever `calculateCashBalance()` returns on the Cash Pulse
  page (which has 2 years of data). For true accuracy, it needs all-time data.

### C) Your Profit from Sales: ₹8,96,036.38

- **File:** `business-cards.tsx:85-90` → `profit-calculations-new.ts:183-199`
- **Calculation:** `getProfitMetrics(filteredEntries, start, end)`.
  When "All Time" is selected, start/end are null, so all entries in the array
  are processed — but the array only has 30 days.

- **Revenue includes:** Cash IN Sales + ALL Credit Sales + Advance Settlement (Received)
- **Expenses include:** Cash OUT COGS/Opex + Credit COGS/Opex + Advance Settlement (Paid)

- **Problem:** "All Time" profit is really "last 30 days profit" on the home page.
  The Profit Lens analytics page shows a different number for the same period.

### D) Fixed Assets: ₹48,754.46

- **File:** `business-cards.tsx:59-61`
- **Filter:** `entries.filter(e => e.category === 'Assets').reduce(sum + e.amount)`
- **Problem:** Only sums Asset entries from the last 30 days.
  Any fixed assets purchased more than 30 days ago are excluded.

### E) Liabilities: ₹1,537

- **File:** `business-cards.tsx:65-81`
- Bills to Pay and Customer Advances from 30-day dataset only.
  Unsettled bills or advances older than 30 days are excluded.

---

## Impact of the financial-summary.ts Fix

The recent commit `c04c2a0` modified `lib/financial-summary.ts` only. This file
builds text summaries for Donna AI prompts — it has **zero connection** to the
dashboard components. The fix added `category === 'Sales'` to the pending
collections filter in the AI context, which was correct, but it does not affect
any dashboard numbers.

---

## Additional Observations

### `balance.ts` running balance diverges from dashboard

`getCashDelta()` in `balance.ts:11-21` returns 0 for `Credit Settlement
(Collections)` and `Credit Settlement (Bills)`. But `calculateCashBalance()` in
`analytics-new.ts:47-69` counts these types. This means the stored
`running_cash_balance` in the profiles table (used for alerts) differs from what
the Cash Pulse dashboard displays.

### `getEntriesForAnalytics()` also has limits

Even the analytics pages have a 2-year lookback and 5000-row cap. For businesses
with older entries or more than 5000 total entries, even Cash Pulse would show
incomplete data. Balance-sheet items (cash, receivables, payables, assets) are
cumulative and ideally need ALL entries.

---

## Summary of All Discrepancies

| Metric             | Home Value     | Correct Source  | Root Cause                                 | Severity |
|--------------------|----------------|-----------------|--------------------------------------------|----------|
| Money to Collect   | ₹6,14,223.45  | Cash Pulse      | 30-day data misses older unsettled credits  | HIGH     |
| Cash in Bank/Hand  | ₹2,69,470.47  | Full dataset    | Running balance needs ALL entries           | CRITICAL |
| Profit from Sales  | ₹8,96,036.38  | Profit Lens pg  | "All Time" from only 30 days of entries     | HIGH     |
| Fixed Assets       | ₹48,754.46    | Full dataset    | Asset purchases >30 days old excluded       | HIGH     |
| Total Assets       | ₹9,32,448.38  | Full dataset    | All components understated                  | HIGH     |
| Liabilities        | ₹1,537         | Full dataset    | Old unsettled bills excluded                | MEDIUM   |

---

## Recommended Fix Strategy (pending review)

1. Replace `getRecentEntries()` with `getEntriesForAnalytics()` in
   `app/home/page.tsx:34` for the BusinessCards component
2. Or: compute balance-sheet metrics server-side from the full entries table
3. Fix `balance.ts:getCashDelta()` to count Credit Settlement types
4. Consider a dedicated `getBalanceSheetData()` server action for cumulative metrics
