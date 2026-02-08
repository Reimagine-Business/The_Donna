# Home Page Architecture & Dependencies

> Last updated: 2026-02-08
> Scope: `app/home/page.tsx` and all direct dependencies

---

## 1. Architecture Diagram

```
                        ┌─────────────────────────────────────────────────────┐
                        │              middleware.ts                           │
                        │  Route guards, session refresh, redirects           │
                        └──────────────────────┬──────────────────────────────┘
                                               │
                                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     app/home/page.tsx  (Server Component)                     │
│  export const dynamic = 'force-dynamic'                                      │
│  export const revalidate = 0                                                 │
│                                                                              │
│  Data Fetching (server-side):                                                │
│  ┌──────────────────────┬───────────────────┬─────────────────────────────┐  │
│  │ getOrRefreshUser()   │ getEntries()      │ supabase.from('profiles')   │  │
│  │ → auth check         │ → entries table   │ → business_name             │  │
│  │                      │   (limit 100)     │                             │  │
│  │                      │                   │ supabase.from('reminders')  │  │
│  │                      │                   │ → pending, ordered by date  │  │
│  └──────────┬───────────┴─────────┬─────────┴──────────────┬──────────────┘  │
│             │                     │                        │                 │
│             ▼                     ▼                        ▼                 │
│  ┌─────────────────┐  ┌────────────────────┐  ┌───────────────────────────┐  │
│  │  SiteHeader     │  │  TopNavMobile      │  │  BottomNav                │  │
│  │  (desktop only) │  │  (mobile only)     │  │  (mobile only)            │  │
│  │  hidden md:flex │  │  md:hidden         │  │  md:hidden                │  │
│  └────────┬────────┘  └────────┬───────────┘  └───────────────────────────┘  │
│           │                    │                                             │
│           ▼                    ▼                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      Content Area                                      │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │  GreetingSection (Client)                                       │   │  │
│  │  │  Props: { businessName: string | null }                         │   │  │
│  │  │  Dynamic greeting by time of day                                │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │  BusinessInsights (Client) — "Today's News"                     │   │  │
│  │  │  Props: { entries: Entry[], reminders: Reminder[] }             │   │  │
│  │  │  Priority-sorted news items (top 3)                             │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │  │
│  │  │  BusinessSnapshot (Client) — "How is your Business doing?"      │   │  │
│  │  │  Props: { entries: Entry[] }                                    │   │  │
│  │  │  Uses: calculateCashBalance(), getProfitMetrics()               │   │  │
│  │  │  Sub-sections: What's Yours, What's NOT Yours, Profit           │   │  │
│  │  │  Includes: PeriodFilter, DonnaIcon, expandable details          │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. File Structure Map

| File | Type | Role |
|------|------|------|
| `app/home/page.tsx` | Server Component | Main page, data fetching, layout |
| `components/home/greeting-section.tsx` | Client Component | Dynamic greeting by time of day |
| `components/home/business-insights.tsx` | Client Component | "Today's News" — priority-sorted insights |
| `components/home/alerts-section.tsx` | Client Component | Alert cards (NOT currently used on home page) |
| `components/home/view-all-alerts-modal.tsx` | Client Component | Modal for viewing all alerts |
| `components/home/home-shell.tsx` | Client Component | **LEGACY — not used** |
| `components/dashboard/business-snapshot.tsx` | Client Component | Financial overview cards |
| `components/common/period-filter.tsx` | Client Component | Time period selector (all-time / year) |
| `components/common/donna-icon.tsx` | Client Component | Custom icon component |
| `components/navigation/bottom-nav.tsx` | Client Component | Mobile bottom navigation (5 tabs) |
| `components/navigation/top-nav-mobile.tsx` | Client Component | Mobile header bar |
| `components/navigation/hamburger-menu.tsx` | Client Component | Mobile slide-out menu |
| `components/site-header.tsx` | Client Component | Desktop navigation header |
| `components/navigation/desktop-nav.tsx` | Client Component | Desktop nav links |
| `components/navigation/desktop-user-menu.tsx` | Client Component | Desktop user dropdown |
| `lib/analytics-new.ts` | Utility | Cash Pulse (cash-basis) calculations |
| `lib/profit-calculations-new.ts` | Utility | Profit Lens (accrual-basis) calculations |
| `lib/entries.ts` | Types | Entry type definitions and normalization |
| `lib/icon-mappings.ts` | Utility | DonnaIcon name mappings |
| `app/entries/actions.ts` | Server Action | `getEntries()`, `createEntry()`, `generateAlertsForEntry()` |
| `app/reminders/actions.ts` | Server Action | CRUD for reminders |
| `app/notifications/actions.ts` | Server Action | Alert management (read, delete) |
| `middleware.ts` | Middleware | Auth session, route redirects |

---

## 3. Data Sources & Database Queries

### 3.1 Server-Side Queries (in `app/home/page.tsx`)

| Query | Table | Filter | Fields | Limit |
|-------|-------|--------|--------|-------|
| Auth check | `auth.users` | session cookie | user object | 1 |
| Entries | `entries` + `parties` (join) | `user_id = current` | `*, party:parties(name)` | 100 |
| Profile | `profiles` | `user_id = current` | `business_name` | 1 |
| Reminders | `reminders` | `user_id = current, status = 'pending'` | `*` | all pending |

### 3.2 Client-Side Queries (in navigation components)

| Component | Query | Method |
|-----------|-------|--------|
| `SiteHeader` | `auth.getUser()` + `profiles(username, business_name)` | React Query (5min stale) |
| `TopNavMobile` | `auth.getUser()` + `profiles(username, business_name, logo_url)` | useEffect (no cache) |

### 3.3 Entry Type System

```
Primary Types:          Settlement Types:
├── Cash IN             ├── Credit Settlement (Collections)
├── Cash OUT            ├── Credit Settlement (Bills)
├── Credit              ├── Advance Settlement (Received)
└── Advance             └── Advance Settlement (Paid)

Categories: Sales | COGS | Opex | Assets
Payment Methods: Cash | Bank | None
```

---

## 4. Shared Components Between Pages

### 4.1 Navigation (shared by ALL pages)

| Component | Used By | Notes |
|-----------|---------|-------|
| `SiteHeader` | home, entries, cashpulse, profitlens, alerts, profile | Desktop only (hidden md:flex) |
| `TopNavMobile` | home, entries, cashpulse, profitlens, alerts, profile | Mobile only (md:hidden) |
| `BottomNav` | home, entries, cashpulse, profitlens, alerts | Mobile only, 5 nav items |

### 4.2 Calculation Libraries

| Library | Used By Home | Also Used By |
|---------|-------------|--------------|
| `analytics-new.ts` → `calculateCashBalance()` | BusinessSnapshot | CashPulse shell |
| `profit-calculations-new.ts` → `getProfitMetrics()` | BusinessSnapshot | ProfitLens shell |
| `period-filter.tsx` → `getDateRangeForPeriod()` | BusinessSnapshot | CashPulse, ProfitLens |

### 4.3 Home-Only Components (not shared)

| Component | Exclusive To |
|-----------|-------------|
| `GreetingSection` | Home page only |
| `BusinessInsights` | Home page only |
| `BusinessSnapshot` | Home page only (but uses shared libs) |

---

## 5. Data Flow Diagram

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────────────────────┐
│  Supabase   │────▶│  Server      │────▶│  Client Components               │
│  Database   │     │  page.tsx     │     │                                  │
└─────────────┘     └──────────────┘     └──────────────────────────────────┘

Detailed flow:

1. REQUEST → middleware.ts
   └── updateSession() → refresh auth cookies (24h maxAge)
   └── Route redirects: /daily-entries → /entries, /admin/users → /profile

2. SERVER RENDER → app/home/page.tsx
   ├── getOrRefreshUser(supabase) → auth check, redirect if no user
   ├── getEntries() → SELECT *, party:parties(name) FROM entries ... LIMIT 100
   ├── supabase.from('profiles') → business_name
   └── supabase.from('reminders') → pending reminders ordered by due_date

3. PROPS PASSED DOWN (server → client):
   ├── GreetingSection ← { businessName }
   ├── BusinessInsights ← { entries, reminders }
   └── BusinessSnapshot ← { entries }

4. CLIENT-SIDE COMPUTATIONS (in useMemo):
   ├── BusinessInsights:
   │   ├── Cash balance (inline calculation)
   │   ├── Overdue reminders, upcoming reminders
   │   ├── Today's cash IN, yesterday comparison
   │   ├── Overdue bills, bills due soon
   │   ├── Pending collections, recent settlements
   │   └── Returns top 3 items sorted by priority (1=critical → 4=success)
   │
   └── BusinessSnapshot:
       ├── calculateCashBalance(entries) → Cash in Bank/Hand
       ├── Receivables, Prepaid, Fixed Assets (inline filters)
       ├── Credit Bills, Customer Advances (inline filters)
       └── getProfitMetrics(filteredEntries) → Net Profit

5. REVALIDATION (triggered by server actions):
   ├── createEntry() → revalidatePath('/home')
   ├── updateEntry() → revalidatePath('/home')
   ├── deleteEntry() → revalidatePath('/home')
   ├── createReminder() → revalidatePath('/home')
   ├── markReminderDone() → revalidatePath('/home')
   ├── updateReminder() → revalidatePath('/home')
   └── deleteReminder() → revalidatePath('/home')
```

---

## 6. Calculation Dependencies

### 6.1 BusinessSnapshot Calculations

```
"What's Yours" (Assets):
├── Cash         = calculateCashBalance(entries)     [from analytics-new.ts]
│                  Cash IN + Credit Settlement (Collections) + Advance(Sales)
│                  - Cash OUT - Credit Settlement (Bills) - Advance(COGS/Opex/Assets)
├── Receivables  = Credit(Sales, unsettled).remaining_amount
├── Prepaid      = Advance(COGS/Opex/Assets, unsettled).remaining_amount
└── Fixed Assets = entries.filter(category=Assets).amount

"What's NOT Yours" (Liabilities):
├── Credit Bills      = Credit(COGS/Opex, unsettled).remaining_amount
└── Customer Advances = Advance(Sales, unsettled).remaining_amount

"Profit" (for selected period):
└── getProfitMetrics(filteredEntries, start, end)    [from profit-calculations-new.ts]
    ├── Revenue = Cash IN(Sales) + Credit(Sales) + Advance Settlement(Received)
    ├── COGS    = Cash OUT(COGS) + Credit(COGS) + Advance Settlement(Paid, COGS)
    ├── Gross Profit = Revenue - COGS
    ├── OpEx    = Cash OUT(Opex) + Credit(Opex) + Advance Settlement(Paid, Opex)
    ├── Net Profit = Gross Profit - OpEx
    └── Margin  = Net Profit / Revenue * 100
```

### 6.2 BusinessInsights Priority System

| Priority | Level | Triggers |
|----------|-------|----------|
| 1 | Critical | Overdue reminders, cash < 1000, overdue bills |
| 2 | Warning | Upcoming reminders (7 days), cash < 5000, bills due soon, cash IN down 25%+ |
| 3 | Info | Pending collections |
| 4 | Success | Healthy cash (10K+), good cash (5K+), strong daily inflow, cash IN up 25%+, recent settlements |

Max display: **3 items**, sorted by priority (critical first).

---

## 7. Alerts & Reminders Connection

### 7.1 Alert Generation (server-side, automatic)

Alerts are auto-generated in `generateAlertsForEntry()` (called after every `createEntry()`):

| Alert | Type | Threshold |
|-------|------|-----------|
| High Expense | warning | Single entry > 50,000 in COGS/Opex/Assets |
| Low Cash Balance | critical | Cash Pulse balance < 10,000 and >= 0 |
| Negative Balance | critical | Cash Pulse balance < 0 |
| Expenses > Revenue | warning | Monthly expenses > monthly revenue |
| Excessive Spending | critical | Monthly expenses > 150% of revenue |

### 7.2 Home Page vs Alerts Page

| Aspect | Home Page | Alerts Page |
|--------|-----------|-------------|
| Rendering | Server Component | Client Component |
| Data fetching | Server-side `getEntries()` + direct Supabase queries | React Query (client-side) |
| Reminders | Fetched server-side, passed as props | Fetched via React Query |
| Alerts display | Via BusinessInsights (inline calculation) | Via AlertsPageClient component |
| Alert source | Calculated from entries + reminders in `useMemo` | Fetched from `alerts` table |
| Cache strategy | `force-dynamic` (no cache) | React Query (1-5 min stale) |

### 7.3 Revalidation Path Map

```
Action                  →  Paths revalidated
────────────────────────────────────────────
createEntry()           →  /entries, /analytics/cashpulse, /analytics/profitlens, /home
updateEntry()           →  /entries, /analytics/cashpulse, /analytics/profitlens, /home
deleteEntry()           →  /entries, /analytics/cashpulse, /analytics/profitlens, /home
createReminder()        →  /alerts, /home
markReminderDone()      →  /alerts, /home
updateReminder()        →  /alerts, /home
deleteReminder()        →  /alerts, /home
```

---

## 8. Redesign Impact Assessment

### 8.1 Dependency Matrix

| If you change... | Impact on... | Risk |
|------------------|-------------|------|
| `page.tsx` data fetching | All 3 child components | HIGH — must maintain prop contracts |
| `GreetingSection` | Home page only | LOW — isolated, simple props |
| `BusinessInsights` | Home page only | LOW — isolated, self-contained logic |
| `BusinessSnapshot` | Home page only | MEDIUM — uses shared calculation libs |
| `calculateCashBalance()` | Home + CashPulse | HIGH — shared dependency |
| `getProfitMetrics()` | Home + ProfitLens | HIGH — shared dependency |
| `PeriodFilter` | Home + CashPulse + ProfitLens | MEDIUM — shared component |
| `Entry` type definition | ALL pages and calculations | CRITICAL — foundational type |
| `getEntries()` server action | Home + Entries page | HIGH — shared data source |
| Navigation components | ALL pages | MEDIUM — layout changes affect everything |
| `middleware.ts` | ALL pages | CRITICAL — auth/routing for entire app |

### 8.2 Risk Assessment

**SAFE to modify (Home-only, no cross-page impact):**
- `GreetingSection` — isolated, simple prop
- `BusinessInsights` — isolated, inline calculations
- `BusinessSnapshot` UI layout — only prop contract matters
- CSS/styling of any home component
- Adding new sections to home page

**CAUTION (shared dependencies):**
- `PeriodFilter` component — also used by CashPulse and ProfitLens
- `DonnaIcon` / `DonnaIcons` — used across multiple components
- Navigation components — shared by all pages
- `page.tsx` data fetching — changes affect what data is available downstream

**DO NOT modify without cross-page testing:**
- `analytics-new.ts` (`calculateCashBalance`) — used by CashPulse page
- `profit-calculations-new.ts` (`getProfitMetrics`) — used by ProfitLens page
- `lib/entries.ts` (Entry type) — foundational type for entire app
- `app/entries/actions.ts` (`getEntries`) — used by Entries page and Home page
- `middleware.ts` — affects auth flow for all pages

### 8.3 Recommended Approach for Redesign

1. **Component-level changes are safe**: Modify or replace `GreetingSection`, `BusinessInsights`, and `BusinessSnapshot` freely. They receive data via props and don't export anything used elsewhere.

2. **Keep the prop contracts**: If changing `page.tsx`, ensure the same data (entries, reminders, business_name) is still available. New components can receive the same props.

3. **Don't duplicate calculation logic**: BusinessInsights has inline cash/reminder calculations that overlap with `analytics-new.ts`. A redesign should either:
   - Continue using inline logic (simpler, no cross-page risk)
   - Import from shared libs (cleaner, but creates coupling)

4. **Server vs Client boundary**: The current Server → Client data flow is efficient. Avoid moving data fetching to client-side (React Query) on the home page — the server-side approach avoids waterfalls and is already optimized.

5. **Test entry mutations**: After any home page change, verify that `createEntry()`, `updateEntry()`, and `deleteEntry()` still trigger home page refresh via `revalidatePath('/home')`.

### 8.4 Implementation Strategy

```
Phase 1: UI Changes (LOW RISK)
├── Modify/replace GreetingSection
├── Modify/replace BusinessInsights
├── Modify BusinessSnapshot layout
└── Add new home-only sections

Phase 2: Data Layer Changes (MEDIUM RISK)
├── Add new server queries in page.tsx
├── Pass new props to child components
├── Verify revalidation still works
└── Test: create entry → home page updates

Phase 3: Shared Component Changes (HIGH RISK)
├── Only if necessary for redesign
├── Modify PeriodFilter → test CashPulse + ProfitLens
├── Modify calculation libs → test CashPulse + ProfitLens
└── Full regression test after changes
```

---

## 9. Unused / Legacy Code

| File | Status | Notes |
|------|--------|-------|
| `components/home/home-shell.tsx` | **NOT USED** | Legacy shell component, not imported by page.tsx |
| `components/home/alerts-section.tsx` | **NOT USED on home** | Exists but not imported in page.tsx; used to show alerts directly |
| `components/home/view-all-alerts-modal.tsx` | **NOT USED on home** | Only imported by alerts-section.tsx |
| Legacy exports in `analytics-new.ts` | **Deprecated** | `getExpensesByCategory`, `getIncomeByCategory`, etc. aliased for backwards compat |

---

## 10. Database Schema (relevant tables)

```sql
-- entries: Core financial data (limit 100 on home page)
entries (
  id UUID PK,
  user_id UUID FK → auth.users,
  entry_type TEXT,           -- 'Cash IN', 'Cash OUT', 'Credit', 'Advance', + 4 settlement types
  category TEXT,             -- 'Sales', 'COGS', 'Opex', 'Assets'
  payment_method TEXT,       -- 'Cash', 'Bank', 'None'
  amount NUMERIC,
  remaining_amount NUMERIC,
  settled_amount NUMERIC,
  entry_date DATE,
  notes TEXT,
  image_url TEXT,
  settled BOOLEAN,
  settled_at TIMESTAMPTZ,
  party_id UUID FK → parties,
  is_settlement BOOLEAN,
  settlement_type TEXT,
  original_entry_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- profiles: User profile data
profiles (
  user_id UUID FK → auth.users,
  username TEXT,
  business_name TEXT,
  logo_url TEXT
)

-- reminders: User reminders (fetched on home page)
reminders (
  id UUID PK,
  user_id UUID FK → auth.users,
  title TEXT,
  description TEXT,
  due_date DATE,
  status TEXT,               -- 'pending', 'completed'
  category TEXT,
  frequency TEXT,            -- 'one_time', 'weekly', 'monthly', 'quarterly', 'annually'
  next_due_date DATE,
  parent_reminder_id UUID,
  completed_at TIMESTAMPTZ
)

-- alerts: Auto-generated alerts (NOT directly used on home page)
alerts (
  id UUID PK,
  user_id UUID FK → auth.users,
  type TEXT,                 -- 'critical', 'warning', 'info'
  priority INTEGER,
  title TEXT,
  message TEXT,
  is_read BOOLEAN,
  created_at TIMESTAMPTZ
)
```
