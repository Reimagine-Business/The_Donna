# The Donna — Comprehensive Production Audit

**Date:** February 6, 2026
**Production Branch:** `main` (commit `db792fc` — Merge pull request #323)
**App Directory:** `/donna-clean`

---

## Executive Summary

**The Donna** is a production-grade financial management SaaS for small businesses, built on Next.js 16 + Supabase. It implements a **dual-accounting model** — Cash Pulse (cash-basis) and Profit Lens (accrual-basis) — with entry tracking, settlement management, party (customer/vendor) records, automated alerts, and a health-score dashboard. The core financial engine is architecturally sound with atomic database transactions, strict RLS security, and comprehensive input validation. However, the app has significant gaps in reporting, payment management, itemized tracking, and test coverage that need to be addressed before scaling beyond early users.

---

## 1. Current Infrastructure

### 1.1 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.0.7 |
| Runtime | React | 19.2.1 |
| Language | TypeScript | 5.x (strict mode) |
| Database | Supabase (PostgreSQL) | Latest |
| Auth | Supabase Auth (email/password, OTP) | @supabase/ssr 0.7.0 |
| State | React Query (@tanstack/react-query) | 5.90.12 |
| Styling | Tailwind CSS | 3.4.1 |
| UI Components | Radix UI (10 primitives) | Various |
| Charts | Recharts | 2.12.3 |
| Icons | Lucide React | 0.511.0 |
| Toasts | Sonner | 2.0.7 |
| Date Utils | date-fns | 4.1.0 |
| Error Tracking | Sentry (@sentry/nextjs) | 10.30.0 |
| Analytics | Vercel Analytics + Speed Insights | Latest |
| Rate Limiting | Vercel KV (Redis) | 3.0.0 |
| Deployment | Vercel | — |

### 1.2 Environment Variables Required

```
# Core (required)
NEXT_PUBLIC_SUPABASE_URL          — Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — Supabase anon key
NEXT_PUBLIC_SITE_URL              — Production domain (for email links)

# Sentry (recommended for production)
NEXT_PUBLIC_SENTRY_DSN
SENTRY_ORG
SENTRY_PROJECT
SENTRY_AUTH_TOKEN

# Vercel KV (auto-populated by Vercel)
KV_REST_API_URL
KV_REST_API_TOKEN
KV_REST_API_READ_ONLY_TOKEN
```

### 1.3 Security Configuration (next.config.ts)

- `X-Frame-Options: SAMEORIGIN` — Clickjacking protection
- `X-Content-Type-Options: nosniff` — MIME type sniffing prevention
- `X-XSS-Protection: 1; mode=block` — XSS filter
- `Referrer-Policy: origin-when-cross-origin` — Referrer control
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — Feature restrictions
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — HSTS (2 years)
- Sentry source maps uploaded only in production, hidden from client

### 1.4 Middleware (middleware.ts)

- **Route redirects:** `/daily-entries` → `/entries` (legacy), `/admin/users` → `/profile` (v2 feature hidden)
- **Session management:** Supabase cookie-based session via `updateSession()`
- **Matcher:** Excludes static assets, images, and metadata files

---

## 2. Database Schema (Supabase / PostgreSQL)

### 2.1 Schema Diagram

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│    profiles      │     │       entries         │     │     parties      │
│─────────────────│     │──────────────────────│     │─────────────────│
│ id (PK, UUID)   │     │ id (PK, UUID)        │     │ id (PK, UUID)   │
│ user_id (FK→auth)│     │ user_id (FK→auth)    │     │ user_id (FK→auth)│
│ username (UNIQ) │     │ entry_type           │◄────│ name (UNIQ/user)│
│ business_name   │     │ category             │     │ mobile          │
│ address         │     │ payment_method       │     │ party_type      │
│ logo_url        │     │ amount (14,2)        │     │ opening_balance │
│ phone           │     │ remaining_amount     │     │ created_at      │
│ created_at      │     │ settled_amount       │     │ updated_at      │
│ updated_at      │     │ entry_date           │     └─────────────────┘
└─────────────────┘     │ notes                │            ▲
                        │ party_id (FK→parties)│────────────┘
                        │ settled (bool)       │
                        │ settled_at           │
                        │ is_settlement (bool) │
                        │ settlement_type      │
                        │ original_entry_id(FK)│──┐ (self-reference)
                        │ created_at           │  │
                        │ updated_at           │◄─┘
                        └──────────────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────┐
                  │   settlement_history     │
                  │──────────────────────────│
                  │ id (PK, UUID)            │
                  │ user_id (FK→auth)        │
                  │ original_entry_id (FK)   │
                  │ settlement_entry_id (FK) │
                  │ settlement_type          │
                  │ entry_type               │
                  │ category                 │
                  │ amount                   │
                  │ settlement_date          │
                  │ notes                    │
                  │ created_at               │
                  └──────────────────────────┘

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   categories    │     │     alerts       │     │    reminders    │
│─────────────────│     │─────────────────│     │─────────────────│
│ id (PK, UUID)   │     │ id (PK, UUID)   │     │ id (PK, UUID)   │
│ user_id (FK)    │     │ user_id (FK)    │     │ user_id (FK)    │
│ name            │     │ title           │     │ title           │
│ type            │     │ message         │     │ description     │
│ color           │     │ type (info/     │     │ due_date        │
│ icon            │     │   warning/      │     │ category        │
│ created_at      │     │   critical)     │     │ frequency       │
└─────────────────┘     │ priority (0-2)  │     │ status          │
                        │ is_read         │     │ completed_at    │
                        │ read_at         │     │ next_due_date   │
                        │ related_entity  │     │ parent_reminder │
                        │ created_at      │     │ created_at      │
                        └─────────────────┘     │ updated_at      │
                                                └─────────────────┘
```

### 2.2 Table Details

#### `profiles`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, auto-gen |
| user_id | UUID | FK→auth.users, UNIQUE, ON DELETE CASCADE |
| username | TEXT | UNIQUE, regex `^[a-zA-Z0-9_-]{3,20}$` or NULL |
| business_name | TEXT | — |
| address | TEXT | — |
| logo_url | TEXT | — |
| phone | TEXT | — |
| created_at | TIMESTAMPTZ | default NOW() |
| updated_at | TIMESTAMPTZ | auto-updated via trigger |

**Indexes:** `idx_profiles_username`
**Triggers:** `set_updated_at` → updates timestamp on every UPDATE
**Auto-creation:** `handle_new_user()` trigger on `auth.users` INSERT

#### `entries` (core financial table)
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, auto-gen |
| user_id | UUID | FK→auth.users, NOT NULL, ON DELETE CASCADE |
| entry_type | TEXT | NOT NULL, CHECK IN ('Cash Inflow','Cash Outflow','Credit','Advance','Credit Settlement (Collections)','Credit Settlement (Bills)','Advance Settlement (Received)','Advance Settlement (Paid)') |
| category | TEXT | NOT NULL, CHECK IN ('Sales','COGS','Opex','Assets') |
| payment_method | TEXT | NOT NULL, CHECK IN ('Cash','Bank','None'), default 'Cash' |
| amount | NUMERIC(14,2) | NOT NULL, CHECK ≥ 0 |
| remaining_amount | NUMERIC | tracks remaining for partial settlements |
| settled_amount | NUMERIC | amount already settled |
| entry_date | DATE | NOT NULL, default CURRENT_DATE |
| notes | TEXT | optional |
| party_id | UUID | FK→parties, ON DELETE SET NULL |
| settled | BOOLEAN | NOT NULL, default false |
| settled_at | TIMESTAMPTZ | when fully settled |
| is_settlement | BOOLEAN | default false |
| settlement_type | TEXT | CHECK IN ('credit','advance') or NULL |
| original_entry_id | UUID | FK→entries (self-ref), ON DELETE CASCADE |
| created_at | TIMESTAMPTZ | NOT NULL, default NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated |

**Indexes (9):**
- `idx_entries_user_id`, `idx_entries_date`, `idx_entries_type`, `idx_entries_category`
- `idx_entries_user_date` (user_id, date DESC)
- `idx_entries_party_id` (partial: WHERE party_id IS NOT NULL)
- `idx_entries_is_settlement` (partial: WHERE is_settlement = true)
- `idx_entries_original_entry` (partial: WHERE original_entry_id IS NOT NULL)
- `idx_entries_remaining_amount` (partial: WHERE remaining_amount > 0 AND settled = false)

**Triggers:**
- `set_entries_updated_at` — timestamp update
- `trigger_alert_on_large_expense` — creates alert when expense > ₹50,000

#### `parties`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK→auth.users, NOT NULL |
| name | TEXT | NOT NULL, UNIQUE per user |
| mobile | TEXT | optional |
| party_type | TEXT | NOT NULL, CHECK IN ('Customer','Vendor','Both') |
| opening_balance | NUMERIC | default 0 |
| created_at / updated_at | TIMESTAMPTZ | auto |

**Indexes:** `idx_parties_user_id`, `idx_parties_type` (user_id, party_type), `idx_parties_name` (user_id, name)

#### `categories`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK→auth.users, NOT NULL |
| name | TEXT | NOT NULL |
| type | TEXT | NOT NULL, CHECK IN ('income','expense') |
| color | TEXT | default '#7c3aed' |
| icon | TEXT | optional |

**Unique:** (user_id, name, type)
**Default categories created on signup:** Sales, Services, Other Income, COGS, Rent, Salaries, Utilities, Marketing, Other Expenses

#### `alerts`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK→auth.users, NOT NULL |
| title | TEXT | NOT NULL |
| message | TEXT | NOT NULL |
| type | TEXT | CHECK IN ('info','warning','critical') |
| priority | INTEGER | default 0 (0=low, 1=medium, 2=high) |
| is_read | BOOLEAN | default false |
| read_at | TIMESTAMPTZ | — |
| related_entity_type | TEXT | optional link type |
| related_entity_id | TEXT | optional entity UUID |
| created_at | TIMESTAMPTZ | NOT NULL |

**Key index:** UNIQUE on (user_id, title, type) WHERE is_read = false — prevents duplicate unread alerts

#### `reminders`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK→auth.users, NOT NULL |
| title | TEXT | NOT NULL |
| description | TEXT | optional |
| due_date | DATE | NOT NULL |
| category | TEXT | CHECK IN ('bills','task','advance_settlement','others') |
| frequency | TEXT | CHECK IN ('one_time','weekly','monthly','quarterly','annually'), default 'one_time' |
| status | TEXT | CHECK IN ('pending','completed'), default 'pending' |
| completed_at | TIMESTAMPTZ | — |
| next_due_date | DATE | for recurring reminders |
| parent_reminder_id | UUID | FK→reminders (self-ref) |

#### `settlement_history`
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK→auth.users, NOT NULL |
| original_entry_id | UUID | FK→entries, NOT NULL, ON DELETE CASCADE |
| settlement_entry_id | UUID | FK→entries, ON DELETE SET NULL |
| settlement_type | TEXT | CHECK IN ('credit','advance') |
| entry_type | TEXT | CHECK IN ('Credit','Advance') |
| category | TEXT | CHECK IN ('Sales','COGS','Opex','Assets') |
| amount | NUMERIC | NOT NULL |
| settlement_date | DATE | NOT NULL |
| notes | TEXT | — |

### 2.3 RLS (Row Level Security) Policies

All tables enforce `auth.uid() = user_id` on SELECT, INSERT, UPDATE, DELETE for authenticated users. This means:
- Users can only see/modify their own data
- No cross-tenant data access possible
- Realtime subscriptions are user-scoped

**Special:** Alerts table allows system-level INSERT (service role) for automated alert creation.

### 2.4 Key Database Functions

| Function | Purpose |
|----------|---------|
| `settle_entry(entry_id, user_id, amount, date)` | Atomic settlement with transaction locking. Creates cash entries for credit settlements, marks advances as settled. Returns JSON status. |
| `handle_new_user()` | Trigger: auto-creates profile + default categories on signup |
| `check_and_create_alerts(user_id)` | Evaluates business metrics and generates system alerts |
| `alert_on_large_expense()` | Trigger: fires alert for expenses > ₹50,000 |
| `create_alert_safe(...)` | Duplicate-preventing alert creation |
| `cleanup_old_alerts(days)` | Maintenance: removes read alerts older than N days |
| `get_party_balance(party_id)` | Calculates current party balance including opening balance |
| `create_default_categories(user_id)` | Seeds 9 default categories for new users |

---

## 3. File Structure

```
donna-clean/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout (providers, analytics, toast)
│   ├── page.tsx                 # Landing page
│   ├── home/
│   │   └── page.tsx             # Main dashboard (authenticated)
│   ├── entries/
│   │   ├── page.tsx             # Entry list + creation
│   │   └── actions.ts           # Server actions (create, update, delete)
│   ├── analytics/
│   │   ├── cashpulse/page.tsx   # Cash-basis analytics
│   │   └── profitlens/page.tsx  # Accrual-basis analytics
│   ├── settlements/
│   │   └── actions.ts           # Settlement server actions
│   ├── alerts/
│   │   └── page.tsx             # Reminders management
│   ├── notifications/
│   │   └── page.tsx             # System alerts/notifications
│   ├── dashboard/
│   │   └── page.tsx             # Secondary dashboard
│   ├── profile/
│   │   └── page.tsx             # User profile editing
│   ├── settings/
│   │   └── page.tsx             # Account settings
│   ├── auth/
│   │   ├── login/page.tsx       # Email/username login
│   │   ├── sign-up/page.tsx     # Registration
│   │   ├── forgot-password/     # Password reset request
│   │   ├── update-password/     # Password change
│   │   ├── sign-up-success/     # Signup confirmation
│   │   ├── error/page.tsx       # Auth error display
│   │   └── confirm/route.ts     # Email verification handler
│   ├── admin/
│   │   ├── page.tsx             # Admin dashboard
│   │   ├── layout.tsx           # Admin layout + guard
│   │   └── users/
│   │       ├── manage/page.tsx  # User invitations
│   │       └── monitor/page.tsx # Activity monitoring
│   ├── legal/page.tsx           # Legal hub
│   ├── (legal)/
│   │   ├── privacy/page.tsx     # Privacy policy
│   │   └── terms/page.tsx       # Terms of service
│   ├── api/
│   │   ├── health/route.ts      # Health check endpoint
│   │   └── revalidate/route.ts  # ISR cache revalidation
│   └── protected/
│       └── layout.tsx           # Protected route layout
│
├── components/                   # React components (98 total)
│   ├── ui/                      # Radix UI primitives (18 components)
│   ├── navigation/              # Nav bars (desktop, mobile, hamburger)
│   ├── entries/                 # Entry CRUD, filters, party selector
│   ├── settlements/             # Settlement modals and dashboards
│   ├── analytics/               # ProfitLens + CashPulse components
│   ├── dashboard/               # Financial health, business snapshot
│   ├── home/                    # Home page sections
│   ├── alerts/                  # Alert/reminder CRUD
│   ├── notifications/           # System notification display
│   ├── profile/                 # Profile editing modals
│   ├── auth/                    # Auth forms and session management
│   ├── admin/                   # Admin tools
│   ├── common/                  # DonnaIcon, period filter
│   ├── empty-states/            # No data display components
│   ├── skeletons/               # Loading skeleton components
│   └── tutorial/                # Supabase setup tutorials
│
├── lib/                         # Core business logic
│   ├── supabase/                # Supabase client factories
│   │   ├── client.ts            # Browser client
│   │   ├── server.ts            # Server client
│   │   ├── get-user.ts          # Auth helper
│   │   └── middleware.ts        # Session middleware
│   ├── entries.ts               # Entry type definitions + normalization
│   ├── validation.ts            # Input validation suite
│   ├── analytics-new.ts         # Cash Pulse calculations
│   ├── profit-calculations-new.ts # Profit Lens calculations
│   ├── calculate-health-score.ts # Financial health algorithm
│   ├── alert-system.ts          # Alert trigger conditions
│   ├── parties.ts               # Party types and helpers
│   ├── date-utils.ts            # Date range utilities
│   ├── category-mapping.ts      # Display labels and colors
│   ├── sanitization.ts          # XSS prevention
│   ├── rate-limit.ts            # Request rate limiting
│   ├── toast.ts                 # Toast notification helpers
│   ├── utils.ts                 # cn() class merger
│   ├── format-number-words.ts   # Number formatting
│   ├── event-tracking.ts        # Analytics events
│   ├── icon-mappings.ts         # Icon assignments
│   ├── action-wrapper.ts        # Server action wrapper
│   └── admin/
│       └── check-admin.ts       # Admin auth guard
│
├── types/
│   └── supabase.ts              # TypeScript database types
│
├── utils/supabase/
│   └── server.ts                # Alternate server client
│
├── database/
│   └── schema/
│       └── business-tables.sql  # Main schema definition
│
├── database-fixes/              # SQL fix scripts
├── supabase/
│   ├── entries-table.sql        # Entries schema
│   └── migrations/              # 17 migration files
├── scripts/
│   └── supabase-rls.sql         # RLS configuration
│
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── middleware.ts
├── instrumentation.ts           # Sentry instrumentation
├── sentry.client.config.ts
├── sentry.server.config.ts
├── sentry.edge.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── components.json              # shadcn/ui config
└── *.md                         # Documentation files (14 total)
```

---

## 4. Current Features (What Users Can Do)

### 4.1 Financial Entry Tracking

Users can create 4 entry types with strict category/payment rules:

| Entry Type | Allowed Categories | Payment Methods | Party Required | Cash Pulse | Profit Lens |
|-----------|-------------------|----------------|---------------|------------|-------------|
| **Cash IN** | Sales only | Cash, Bank | No | +Cash IN | +Revenue |
| **Cash OUT** | COGS, Opex, Assets | Cash, Bank | No | +Cash OUT | +Expense |
| **Credit** | Sales, COGS, Opex, Assets | None (forced) | Yes | No impact | +Revenue or +Expense (immediate) |
| **Advance** | Sales, COGS, Opex, Assets | Cash, Bank | Yes | +Cash IN or +Cash OUT | No impact (deferred) |

**Entry fields:** Amount, Date, Category, Payment method, Party (optional/required), Notes

**Validation:**
- Amount: positive, max ₹99,99,99,999.99, 2 decimal places
- Date: not future, not older than 5 years
- Rate limit: 100 entries per day per user (via Vercel KV)
- Server-side input sanitization (XSS prevention)

### 4.2 Settlement System

**Credit Settlements** (collecting payments / paying bills):
- Creates a new Cash IN or Cash OUT entry
- Original credit entry's `remaining_amount` decremented
- Marked settled when remaining reaches 0
- Supports partial settlements (half or custom amount)
- Impact: Adds to Cash Pulse, no change in Profit Lens (already counted)

**Advance Settlements** (work completion):
- Creates a new settlement tracking entry (no cash movement)
- Original advance entry marked settled
- Impact: Adds to Profit Lens, no change in Cash Pulse (already counted)

All settlements use atomic PostgreSQL transactions via `settle_entry()` RPC with row locking.

### 4.3 Dashboard & Analytics

#### Home Page (`/home`)
- Greeting with business name
- Business insights (key financial metrics)
- Alert summary
- Business snapshot with recent entries

#### Cash Pulse (`/analytics/cashpulse`)
- **Cash IN total** = Cash Inflows + Advance (Sales) + Credit Settlement (Collections)
- **Cash OUT total** = Cash Outflows + Advance (Expenses) + Credit Settlement (Bills)
- **What's Left** = Cash IN - Cash OUT
- Daily cash flow trend chart
- Monthly comparison (current vs previous month with % change)
- Category breakdown
- CSV export

#### Profit Lens (`/analytics/profitlens`)
- **Revenue** = Cash IN Sales + Credit Sales (all) + Advance Settlement (Received)
- **COGS** = Cash OUT COGS + Credit COGS + Advance Settlement (Paid) COGS
- **OpEx** = Cash OUT Opex + Credit Opex + Advance Settlement (Paid) Opex
- **Gross Profit** = Revenue - COGS
- **Net Profit** = Gross Profit - OpEx
- **Profit Margin** = (Net Profit / Revenue) × 100%
- 6-month profit trend chart
- Top 5 expenses
- CSV export

#### Financial Health Score (`/home`)
- **100-point scale** across 4 dimensions:
  - Cash Health (30 pts): positive balance + runway (>50% of monthly sales)
  - Profit Health (30 pts): positive profit + margin (>20%)
  - Collections Health (20 pts): based on oldest outstanding collection age
  - Payables Health (20 pts): based on oldest outstanding bill age
- Status: Excellent (85+), Good (70+), Fair (50+), Needs Attention (<50)

### 4.4 Alerts & Notifications

**Automated alerts triggered on entry creation:**

| Alert | Condition | Severity |
|-------|-----------|----------|
| Negative Cash Balance | balance < ₹0 | Critical (priority 2) |
| Low Cash Balance | ₹0 ≤ balance < ₹10,000 | Warning (priority 1) |
| Large Expense | single expense ≥ ₹50,000 | Warning (priority 1) |
| Expenses > Revenue | monthly expenses exceed revenue | Warning (priority 1) |
| Excessive Spending | expenses > 150% of revenue | Critical (priority 2) |
| Low Profit Margin | margin < 5% | Warning (priority 1) |
| Operating at Loss | margin < 0% | Critical (priority 2) |
| High COGS | COGS > 50% of revenue | Warning (priority 1) |

**Reminders system:**
- User-created reminders with due dates
- Categories: bills, task, advance_settlement, others
- Frequency: one-time, weekly, monthly, quarterly, annually
- Status tracking: pending / completed

### 4.5 Party Management

- Create customers, vendors, or both
- Link parties to Credit and Advance entries
- Track opening balance per party
- Unique names per user
- Party type filtering (Customer / Vendor / Both)
- Balance calculation via `get_party_balance()` function

### 4.6 User Experience

**Authentication:**
- Email + password registration
- Username-based login (alternative to email)
- Email verification via OTP
- Password reset flow
- Session management via Supabase SSR cookies

**Navigation:**
- Desktop: top navigation bar (Home, Entries, Cashpulse, Profit Lens, Alerts)
- Mobile: bottom navigation bar + hamburger menu
- User dropdown menu (profile, settings, logout)

**Profile:**
- Edit username, business name, address
- Upload business logo
- Change password
- Delete account

**Admin panel** (single admin: `reimaginebusiness2025@gmail.com`):
- Total user and entry statistics
- User management (invite/create)
- Activity monitoring

---

## 5. Data Flow & Business Logic

### 5.1 Entry Type Flow Diagram

```
                    ┌──────────────┐
                    │  User Creates │
                    │    Entry      │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐────────────┐
              ▼            ▼            ▼            ▼
         ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
         │ Cash IN  │ │ Cash OUT│ │  Credit  │ │ Advance │
         │ (Sales)  │ │ (Costs) │ │ (Owed)   │ │ (Prepaid)│
         └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
              │            │            │            │
              ▼            ▼            ▼            ▼
         Cash Pulse:  Cash Pulse:  Profit Lens:  Cash Pulse:
         +Cash IN     +Cash OUT    +Rev or +Exp  +Cash IN/OUT
         Profit Lens: Profit Lens: (immediate)   (immediate)
         +Revenue     +Expense     Cash: NONE    Profit: DEFERRED
              │            │            │            │
              │            │            ▼            ▼
              │            │     ┌──────────┐ ┌──────────┐
              │            │     │  Settle   │ │  Settle   │
              │            │     │  Credit   │ │  Advance  │
              │            │     └────┬─────┘ └────┬─────┘
              │            │          │            │
              │            │          ▼            ▼
              │            │     Cash Pulse:   Profit Lens:
              │            │     +Cash IN/OUT  +Rev or +Exp
              │            │     Profit: NONE  Cash: NONE
              │            │          │            │
              └────────────┴──────────┴────────────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │  Health Score  │
                              │  Calculation   │
                              │  (Cash+Profit  │
                              │  +Collections  │
                              │  +Payables)    │
                              └───────────────┘
```

### 5.2 Cash Pulse Formulas (lib/analytics-new.ts)

```
Cash IN = Σ(Cash Inflow entries)
        + Σ(Advance entries WHERE category = 'Sales')
        + Σ(Credit Settlement (Collections) entries)

Cash OUT = Σ(Cash Outflow entries)
         + Σ(Advance entries WHERE category IN ['COGS','Opex','Assets'])
         + Σ(Credit Settlement (Bills) entries)

What's Left = Cash IN − Cash OUT
```

**Key exclusions:**
- Credit entries (no cash moved yet)
- Advance Settlement entries (cash already counted with original Advance)

### 5.3 Profit Lens Formulas (lib/profit-calculations-new.ts)

```
Revenue = Σ(Cash IN Sales, excluding settlements)
        + Σ(ALL Credit entries WHERE category = 'Sales')
        + Σ(Advance Settlement (Received))

COGS = Σ(Cash OUT COGS, excluding settlements)
     + Σ(ALL Credit entries WHERE category = 'COGS')
     + Σ(Advance Settlement (Paid) WHERE category = 'COGS')

OpEx = Σ(Cash OUT Opex, excluding settlements)
     + Σ(ALL Credit entries WHERE category = 'Opex')
     + Σ(Advance Settlement (Paid) WHERE category = 'Opex')

Gross Profit = Revenue − COGS
Net Profit   = Gross Profit − OpEx
Margin       = (Net Profit / Revenue) × 100%
```

**Key exclusions:**
- Original Advance entries (expense/revenue deferred until settlement)
- Credit Settlement entries (already counted when Credit was created)

### 5.4 Why There's No Double Counting

| Scenario | Cash Pulse | Profit Lens | Reason |
|----------|-----------|-------------|--------|
| Credit Sale of ₹10K | — | +₹10K Revenue | Accrual: recognized at invoice |
| Settle Credit (collect ₹10K) | +₹10K Cash IN | — | Cash received, revenue already counted |
| Advance Payment of ₹5K | +₹5K Cash OUT | — | Cash paid, expense deferred |
| Settle Advance (work done) | — | +₹5K Expense | Work completed, cash already counted |

---

## 6. Current Limitations & Gaps

### 6.1 Sales Tracking — LUMPSUM ONLY

| Capability | Status | Detail |
|-----------|--------|--------|
| Lumpsum entry by category | ✅ Works | Single amount per entry |
| Itemized products/services | ❌ Missing | No line items or product database |
| Top-selling items | ❌ Missing | No product-level analytics |
| Category breakdown | ⚠️ Partial | Only by predefined categories (Sales, Services, Other) |
| Subcategories | ❌ Missing | No hierarchy within categories |
| Invoice generation | ❌ Missing | No invoice/receipt creation |

### 6.2 Expense Tracking — LIMITED CATEGORIES

| Capability | Status | Detail |
|-----------|--------|--------|
| COGS vs OpEx distinction | ✅ Works | Core to Profit Lens |
| Granular expense categories | ⚠️ Partial | 6 default categories, user can't add custom |
| Subcategory support | ❌ Missing | No nested categories |
| Budget tracking per category | ❌ Missing | No budget vs actual |
| Vendor-specific expense tracking | ❌ Missing | Party linked but no analytics |
| Fixed vs variable cost classification | ❌ Missing | — |

### 6.3 Payment Management — BASIC SETTLEMENTS ONLY

| Capability | Status | Detail |
|-----------|--------|--------|
| Credit settlement (full/partial) | ✅ Works | Atomic, with history |
| Advance settlement | ✅ Works | Atomic, with history |
| Due date tracking | ❌ Missing | No due_date field on entries |
| Payment reminders | ⚠️ Partial | Reminders table exists, basic UI exists |
| Outstanding payment aging | ❌ Missing | No 30/60/90 day aging report |
| DSO (Days Sales Outstanding) | ❌ Missing | — |
| Payment terms (Net 30, etc.) | ❌ Missing | — |
| Auto-reminders for overdue | ❌ Missing | — |

### 6.4 Reporting — CSV ONLY

| Capability | Status | Detail |
|-----------|--------|--------|
| CSV export | ✅ Works | Entries, Cash Pulse, Profit Lens |
| PDF export | ❌ Missing | — |
| Date range filtering (preset) | ✅ Works | Month, 3 months, Year |
| Custom date range | ❌ Missing | No arbitrary date picker |
| Monthly trend charts | ✅ Works | Basic line/bar charts |
| Year-over-year comparison | ❌ Missing | — |
| Report scheduling | ❌ Missing | — |
| Email delivery | ❌ Missing | — |
| Cash flow forecasting | ❌ Missing | — |

### 6.5 Priority Gaps for Next Phase

```
Priority 1 (Critical for growth):
├── Itemized sales tracking (products/services)
├── Custom date range filtering
├── Payment due dates + aging analysis
└── PDF export

Priority 2 (Important for retention):
├── Custom expense subcategories
├── Budget vs actual tracking
├── Party transaction history view
└── Advanced reporting (YoY, variance)

Priority 3 (Nice-to-have):
├── Invoice generation
├── Cash flow forecasting
├── Report scheduling
└── Vendor performance analytics
```

---

## 7. Code Quality & Technical Debt

### 7.1 Issues by Severity

#### Critical (fix before scaling)

| Issue | Count | Impact |
|-------|-------|--------|
| `console.log/error` statements | ~142 | Info leakage in production browser console |
| TypeScript `any` types | ~44 | Type safety compromised, possible runtime errors |
| Zero test coverage | 0 files | Cannot safely refactor or verify fixes |
| `metadataBase` not set | 1 | Social previews show localhost URL |

#### Important (fix soon)

| Issue | Count/Detail | Impact |
|-------|-------------|--------|
| No `next/image` usage | 0 Image components | No lazy loading, no optimization |
| Legacy `/app/` folder at repo root | Contains duplicate legal pages | Confusion, potential stale code |
| 6 old build log files in repo | Unnecessary cruft | Repo bloat |
| `@supabase/supabase-js: "latest"` | Unpinned version | Could break on major update |

#### Moderate

| Issue | Detail |
|-------|--------|
| No offline handling | App fails silently without internet |
| No retry logic for failed API calls | Single attempt only |
| Inconsistent error messages | No centralized error constants |
| 56/98 components use performance hooks | Potential unnecessary re-renders |

### 7.2 Positive Code Quality Aspects

- **Strong validation layer**: Client + server-side with sanitization
- **Atomic database operations**: Settlements use PostgreSQL transactions with row locking
- **Proper RLS security**: All tables enforce user isolation
- **Error boundaries**: 4 locations covering key pages
- **Loading states**: Skeleton components and Suspense boundaries throughout
- **Security headers**: Comprehensive set configured in next.config.ts
- **Rate limiting**: Vercel KV-based request throttling
- **Input sanitization**: XSS prevention on all text inputs
- **Modern patterns**: Server Components, Server Actions, React Query caching

---

## 8. Production Status

### 8.1 Current Deployment

- **Platform:** Vercel
- **Branch:** `main`
- **Latest commit:** `db792fc` — Merge pull request #323
- **PR #323:** "Change badge text to white with colored borders only" (UI styling fix)
- **Recent PRs (313-323):** UI redesign, icon fixes, spacing, theme restoration

### 8.2 Monitoring Stack

| Service | Purpose | Status |
|---------|---------|--------|
| Sentry | Error tracking + source maps | Configured (production only) |
| Vercel Analytics | Page views + Web Vitals | Active |
| Vercel Speed Insights | Performance metrics | Active |
| Health endpoint | `/api/health` — DB connectivity check | Available |
| Uptime monitoring | — | Not configured |

### 8.3 Admin Access

- **Admin email:** `reimaginebusiness2025@gmail.com`
- **Admin features:** User stats, user management, activity monitoring
- **Guard:** Server-side check on email + role in every admin route

---

## 9. Recommendations for Next Steps

### Immediate (before AI integration)

1. **Remove all `console.log/error` statements** — Replace with Sentry breadcrumbs or structured logging
2. **Fix TypeScript `any` types** — Especially in analytics components and profile page
3. **Pin `@supabase/supabase-js` version** — Avoid surprise breaking changes
4. **Set `metadataBase`** in layout.tsx to production URL
5. **Clean up repo** — Remove build logs, legacy `/app/` root folder, old documentation files

### Short-term (foundation for AI features)

6. **Add automated tests** — Install Vitest + React Testing Library, cover settlement logic and calculation functions first
7. **Add `due_date` to entries table** — Enables payment aging, reminders, and AI-driven payment predictions
8. **Build custom date range picker** — Required for flexible AI-driven analytics queries
9. **Create API routes for data access** — Current app uses Server Actions only; AI features need stable API endpoints
10. **Add products/items table** — Schema: `id, user_id, name, category, price, unit` — Enables itemized tracking

### Medium-term (AI readiness)

11. **Implement PDF export** — For AI-generated reports
12. **Build aging analysis dashboard** — For AI payment prediction input
13. **Add budget tracking** — For AI budget recommendations
14. **Create structured API layer** — REST or tRPC endpoints that an AI agent can call
15. **Add event/webhook system** — So AI can react to financial events in real time

---

## 10. Architecture Assessment for AI Integration

### What's Ready
- **Clean data model**: Single `entries` table with consistent types makes it easy to query
- **Dual accounting views**: Cash Pulse + Profit Lens provide complementary data perspectives
- **Health score**: Already a structured scoring system that AI can enhance
- **Alert system**: Has the infrastructure; AI can generate smarter, predictive alerts
- **Party management**: Customer/vendor data exists for AI-driven relationship insights

### What's Needed
- **API endpoints**: Currently all data flows through Server Actions — need REST/API routes for AI agent access
- **Product/item data**: Without itemized tracking, AI can't do product-level analysis
- **Historical depth**: Need date range flexibility for AI trend analysis
- **Webhook/event system**: AI needs to react to entries in real-time
- **Structured response format**: Standardize API responses for AI consumption

### Recommended AI Integration Points

```
1. Smart Entry Suggestions    → Analyze past entries to auto-fill fields
2. Cash Flow Forecasting      → Use historical data to predict future cash position
3. Payment Risk Scoring       → Score each outstanding credit by likelihood of late payment
4. Expense Anomaly Detection  → Flag unusual expenses based on historical patterns
5. Natural Language Queries    → "How much did I spend on COGS last quarter?"
6. Automated Insights         → Daily/weekly AI-generated business summaries
7. Budget Recommendations     → Suggest budgets based on historical spending
```

---

*Report generated from codebase analysis on February 6, 2026.*
*App version: Next.js 16.0.7 | React 19.2.1 | Supabase (PostgreSQL)*
