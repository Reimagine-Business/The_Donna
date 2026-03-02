# Production Readiness Audit: BusinessCards Fixes

**Date:** 2026-03-02
**Audited commits:**
- `c99e4b0` — fix: align Bills to Pay filter with Cash Pulse and apply period filter to all balance sheet metrics
- `c04c2a0` — fix: align AI insights pending collections with dashboard data

**Files audited:**
- `components/home-v2/business-cards.tsx` (main component)
- `components/common/period-filter.tsx` (period/year logic)
- `lib/financial-summary.ts` (AI insights summary)
- `components/analytics/cash-pulse-analytics.tsx` (Cash Pulse — reference)
- `lib/analytics-new.ts` (calculateCashBalance)
- `lib/profit-calculations-new.ts` (getProfitMetrics)
- `lib/entries.ts` (Entry type definition)
- `app/entries/actions.ts` (data fetching)

---

## AUDIT 1: Double-counting in Bills to Pay / Fixed Assets

### Result: ❌ FAIL — double-count bug exists

### Findings

**Bills to Pay filter** (`business-cards.tsx:65-72`):
```ts
entry_type === "Credit" && ["COGS", "Opex", "Assets"].includes(category) && !settled
→ sums remaining_amount ?? amount
```

**Fixed Assets filter** (`business-cards.tsx:59-61`):
```ts
category === "Assets"
→ sums amount (no entry_type filter, no settled filter)
```

#### 1. Settled Credit+Assets entries excluded from Bills to Pay?
**YES — correctly excluded.** The `!e.settled` condition filters them out. ✅

#### 2. Same entries appearing in both Bills to Pay AND Fixed Assets?
**YES — this is a confirmed double-count.**

An **unsettled Credit entry with category "Assets"** (e.g., equipment purchased on credit, not yet paid) will:
- Match Fixed Assets: `category === "Assets"` — counted at `e.amount` ✅ matches
- Match Bills to Pay: `entry_type === "Credit" && category in [COGS,Opex,Assets] && !settled` — counted at `remaining_amount ?? amount` ✅ matches

**Both filters catch the same entry.** However, from an accounting perspective, this is actually **correct balance sheet presentation**: the asset exists (Fixed Assets) and the liability exists (Bills to Pay). The "What's Yours" total includes the asset, and "What's Not Yours" includes the debt. Net worth = totalOwn - totalOwe is correct.

**BUT** — there is a deeper, more severe double-count bug in Fixed Assets:

#### 3. Fixed Assets over-counts settlement entries

The Fixed Assets filter (`e.category === "Assets"`) has **no entry_type filter**, so it catches ALL entry types with category "Assets":

| Entry Type | Category | Counted in Fixed Assets? | Should it be? |
|---|---|---|---|
| `Cash OUT` + Assets | Cash purchase | ✅ Yes | ✅ Yes — asset acquired |
| `Credit` + Assets | Credit purchase | ✅ Yes | ✅ Yes — asset acquired |
| `Credit Settlement (Bills)` + Assets | Paying the bill | ✅ Yes | ❌ **NO — asset already counted from Credit entry** |
| `Advance` + Assets | Advance for asset | ✅ Yes | ⚠️ Questionable — asset not yet received |
| `Advance Settlement (Paid)` + Assets | Advance fulfilled | ✅ Yes | ⚠️ Advance was already counted |

**Scenario:** Equipment worth ₹1,00,000 purchased on credit:
1. `Credit` entry created → Fixed Assets: +₹1,00,000
2. Later, `Credit Settlement (Bills)` entry created → Fixed Assets: +₹1,00,000
3. **Result:** Fixed Assets shows ₹2,00,000 for a ₹1,00,000 asset

**Severity:** Depends on whether settlement entries are present in the `entries` array. Checking `getEntriesForAnalytics()` (`app/entries/actions.ts:400-408`): it does `SELECT *` from entries with no `entry_type` filter, so **settlement entries ARE included**. Any user who has settled a Credit Assets bill will see inflated Fixed Assets.

#### Recommended fix (not applied):
```ts
const fixedAssets = filteredEntries
  .filter((e) => e.category === "Assets" &&
    ["Cash OUT", "Credit"].includes(e.entry_type))
  .reduce((sum, e) => sum + e.amount, 0);
```

---

## AUDIT 2: filteredEntries consistently applied

### Result: ⚠️ WARNING — works correctly but has a timezone fragility

### Findings

#### 1. getDateRangeForPeriod() return values

The PeriodType is `"all-time" | "year"` only. There is **no** "This Month" or "This Week" option in BusinessCards (those exist only in Cash Pulse).

| Period | start | end |
|---|---|---|
| `"all-time"` | `null` | `null` |
| `"year"` + 2025 | `new Date(2025, 0, 1)` = Jan 1 2025 00:00:00 **local time** | `new Date(2025, 11, 31, 23, 59, 59)` = Dec 31 2025 23:59:59 **local time** |
| `"year"` + 2026 | `new Date(2026, 0, 1)` = Jan 1 2026 00:00:00 **local time** | `new Date(2026, 11, 31, 23, 59, 59)` = Dec 31 2026 23:59:59 **local time** |

**Timezone analysis:**

The date boundaries use **local time** (via `new Date(year, month, day)`), but entry dates are parsed via `new Date(e.entry_date)` where `entry_date` is a date-only string like `"2025-01-15"`. Per the ECMAScript spec, **date-only strings are parsed as UTC midnight**.

This creates a mismatch:
- `new Date("2025-01-01")` = Jan 1 2025 00:00:00 **UTC** = Jan 1 2025 05:30:00 **IST**
- `start = new Date(2025, 0, 1)` = Jan 1 2025 00:00:00 **IST** = Dec 31 2024 18:30:00 **UTC**

For IST (UTC+5:30), this **happens to work correctly** because UTC midnight is always ahead of IST midnight. An entry dated "2025-01-01" (parsed as UTC midnight = 5:30 AM IST) is after the start boundary (IST midnight = 00:00 IST).

**However**, this is fragile — for any timezone behind UTC (Americas, Pacific), the math breaks:
- In US Eastern (UTC-5): `new Date("2025-01-01")` = midnight UTC, while `start` = midnight ET = 5:00 AM UTC → entry would be incorrectly excluded.

Since this is an Indian business app running in IST, the bug is **dormant but real**.

**Missing milliseconds:** `end` is `23:59:59` (no `.999`). Entries parsed as midnight would not be affected, but it's technically imprecise.

#### 2. filteredEntries derivation

```ts
const filteredEntries = start && end
  ? entries.filter((e) => {
      const entryDate = new Date(e.entry_date);  // ← date-only string parsed as UTC
      return entryDate >= start && entryDate <= end;
    })
  : entries;
```

- **Filters on:** `entry_date` ✅ (correct for financial period filtering)
- **Does NOT filter on:** `created_at` or `updated_at` ✅ (correct)

#### 3. "All Time" → filteredEntries === entries?
**YES.** When `period === "all-time"`, `getDateRangeForPeriod` returns `{ start: null, end: null }`. The ternary `start && end` evaluates to `false`, so `filteredEntries = entries`. ✅

**However**, `getEntriesForAnalytics()` has a built-in 2-year lookback (`app/entries/actions.ts:395-397`):
```ts
const twoYearsAgo = new Date()
twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
startDate = twoYearsAgo.toISOString().split('T')[0]
```

So "All Time" in BusinessCards really means **"last 2 years"**, not truly all time. Entries older than 2 years are excluded at the data-fetching level. This is a known limitation for performance but may surprise users.

---

## AUDIT 3: Money to Collect regression check

### Result: ✅ PASS — no regression

### Findings

Current filter in `business-cards.tsx:43-48`:
```ts
const receivables = filteredEntries
  .filter((e) =>
    e.entry_type === "Credit" && e.category === "Sales" && !e.settled
  )
  .reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0);
```

Verification checklist:
- `entry_type === 'Credit'` ✅
- `category === 'Sales'` ✅
- `!settled` ✅
- Uses `remaining_amount ?? amount` ✅ (handles partial settlements)

Cross-reference with Cash Pulse (`cash-pulse-analytics.tsx:213-222`):
```ts
entries.filter(e =>
  e.entry_type === 'Credit' &&
  e.category === 'Sales' &&
  !e.settled
)
.reduce((sum, e) => sum + (e.remaining_amount ?? e.amount), 0)
```
**Identical filter logic.** ✅

Cross-reference with financial-summary.ts (`lines 125-127`, after fix `c04c2a0`):
```ts
.filter((e) => e.entry_type === "Credit" && e.category === "Sales")
.reduce((sum, e) => sum + (e.remaining_amount ?? e.amount ?? 0), 0)
```
**Equivalent** (settled filter applied at the Supabase query level). ✅

The Bug 1 and Bug 2 commits (`c99e4b0`) only changed:
1. `entries` → `filteredEntries` (affects period scoping, not the filter condition)
2. Added `"Assets"` to `creditBills` category list (different metric entirely)

**Money to Collect filter was NOT modified.** No regression. ✅

---

## AUDIT 4: Specific Year — product logic for balance sheet items

### Result: ⚠️ WARNING — period filtering is semantically wrong for balance sheet items

### Current behavior when user selects "Specific Year 2025":

All metrics are computed from `filteredEntries` which only includes entries with `entry_date` in 2025.

| Metric | What it shows (2025 selected) | What user likely expects | Correct? |
|---|---|---|---|
| **Cash in Bank/Hand** | Net cash movement only from entries dated in 2025 | Actual cash balance at end of 2025 | ⚠️ **Misleading** |
| **Money to Collect** | Unsettled Credit Sales invoiced in 2025 | All outstanding receivables as of today | ⚠️ **Misleading** |
| **Advances Paid** | Unsettled advance payments made in 2025 | All outstanding advances regardless of year | ⚠️ **Misleading** |
| **Fixed Assets** | Sum of asset entries dated in 2025 | Total asset value owned (cumulative) | ⚠️ **Misleading** |
| **Bills to Pay** | Unsettled credit bills from 2025 | All outstanding payables as of today | ⚠️ **Misleading** |
| **Customer Advances** | Unsettled customer advances from 2025 | All outstanding customer advances | ⚠️ **Misleading** |
| **Profit from Sales** | Profit on 2025 transactions | Profit earned in 2025 | ✅ **Correct** |

### Analysis

Balance sheet items are **point-in-time/cumulative** by nature:
- **Cash balance** is an accumulation of ALL transactions since inception, not just one year
- **Fixed Assets** represent everything owned, not just what was bought in one year
- **Receivables/Payables** represent all outstanding obligations, regardless of when they were created

Only **income statement** items (revenue, expenses, profit) should be period-filtered.

**Example:** A business bought a ₹5L machine in 2024 and a ₹2L computer in 2025. When viewing 2025:
- Fixed Assets shows ₹2L (only the computer)
- The ₹5L machine "disappears" from the balance sheet
- This would confuse any business owner

**Example:** A customer owes ₹50,000 from a November 2024 invoice (still unpaid). When viewing 2025:
- Money to Collect shows ₹0 for this customer
- The outstanding debt "disappears"
- This is dangerous — the user might think they have no receivables

### Recommendation
Balance sheet items (Cash, Receivables, Fixed Assets, Payables) should always use ALL entries regardless of period, OR should show cumulative values "as of end of selected period". Only profit/revenue/expenses should respect the period filter.

---

## AUDIT 5: Data consistency cross-check

### Result: ⚠️ WARNING — matches on "All Time" only, diverges on specific periods

### Code comparison (All Time mode)

| Metric | BusinessCards code | Cash Pulse code | Same logic? |
|---|---|---|---|
| **Cash in Bank/Hand** | `calculateCashBalance(filteredEntries)` → when All Time, = `calculateCashBalance(entries)` | `calculateCashBalance(entries)` (always ALL entries, line 146) | ✅ Match on All Time |
| **Money to Collect** | `filteredEntries.filter(Credit+Sales+!settled)` → when All Time, = all entries | `entries.filter(Credit+Sales+!settled)` (always ALL entries, line 213) | ✅ Match on All Time |
| **Bills to Pay** | `filteredEntries.filter(Credit+[COGS,Opex,Assets]+!settled)` → when All Time, = all entries | `entries.filter(Credit+[COGS,Opex,Assets]+!settled)` (always ALL entries, line 227) | ✅ Match on All Time |
| **Fixed Assets** | `filteredEntries.filter(category=Assets)` | N/A (Cash Pulse doesn't show Fixed Assets) | N/A |

**Expected values on "All Time":**

| Metric | BusinessCards | Cash Pulse | Match? |
|---|---|---|---|
| Cash in Bank/Hand | `calculateCashBalance(entries)` | ₹6,59,261 | ✅ Same function, same input |
| Money to Collect | Credit+Sales+!settled | ₹7,32,223 | ✅ Same filter logic |
| Bills to Pay | Credit+[COGS,Opex,Assets]+!settled | ₹3,24,605 | ✅ Same filter logic |
| Fixed Assets | category=Assets (all types) | N/A | N/A |

**On "All Time", values match** because both components use the same entries array and the same filter logic. ✅

### Divergence on Specific Year

When BusinessCards has a year selected, its values will be LOWER than Cash Pulse because:
- BusinessCards: period-filters all metrics to entries within that year
- Cash Pulse: pending sections (Collections, Bills, Advances) always use ALL entries; only Cash IN/OUT/What's Left respects the date range

This is **by design** after the Bug 2 fix, but creates user confusion when they navigate from BusinessCards (showing year-filtered values) to Cash Pulse (showing all-time pending values).

### Data source limitation

Both components receive entries from `getEntriesForAnalytics()` which has a **2-year lookback limit** and a **5,000 entry limit**. For businesses with high transaction volume or data older than 2 years, values may be incomplete even on "All Time".

---

## Summary

| Audit | Verdict | Issue |
|---|---|---|
| **1. Double-counting** | ❌ FAIL | Fixed Assets counts settlement entries (Credit Settlement Bills, Advance Settlement Paid) causing inflation. Additionally, unsettled Credit+Assets entries appear in both Fixed Assets and Bills to Pay (this is technically correct accounting but may confuse users). |
| **2. filteredEntries** | ⚠️ WARNING | All 6 metrics now correctly use filteredEntries. Timezone handling works for IST but has a latent bug with UTC vs local time parsing. "All Time" correctly returns all entries. |
| **3. Money to Collect** | ✅ PASS | Filter intact, matches Cash Pulse exactly, no regression from recent fixes. |
| **4. Balance sheet + periods** | ⚠️ WARNING | Period filtering is semantically incorrect for balance sheet items (Cash, Assets, Receivables, Payables). These should be cumulative, not period-scoped. Current behavior causes values to "disappear" when a specific year is selected. |
| **5. Data consistency** | ⚠️ WARNING | Values match Cash Pulse on "All Time" but diverge on specific year (by design). 2-year lookback and 5K entry limit in data fetching could affect accuracy for large/old datasets. |

## Recommended Next Steps (Priority Order)

1. **P0 — Fix Fixed Assets double-count** (Audit 1): Add `entry_type` filter to exclude settlement entries. Only count `Cash OUT` and `Credit` entries with category "Assets".

2. **P1 — Fix balance sheet period semantics** (Audit 4): Balance sheet items (Cash, Receivables, Fixed Assets, Payables) should either:
   - Always use all entries regardless of period selection, OR
   - Compute cumulative values up to the end of the selected period

3. **P2 — Fix timezone parsing** (Audit 2): Use consistent date parsing — either both UTC or both local time. Safest approach: `new Date(e.entry_date + 'T00:00:00')` (forces local time parsing) instead of `new Date(e.entry_date)` (UTC).

4. **P3 — Investigate data fetch limits** (Audit 5): The 2-year lookback and 5K entry limit may need adjustment as the business grows. Consider separate queries for balance sheet (all-time, lightweight) vs income statement (period-scoped).
