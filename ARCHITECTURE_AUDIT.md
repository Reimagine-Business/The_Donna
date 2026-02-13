# The Donna — Complete Architecture Audit

**Date:** 2026-02-13
**Auditor:** Senior Next.js Architect
**Scope:** Full codebase audit of `donna-clean/` — a financial management SaaS for small business owners in India

---

## 1. Project Overview

### Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.0.7 |
| Runtime | React | 19.2.1 |
| Language | TypeScript (strict mode) | 5.x |
| Auth + DB | Supabase (SSR) | @supabase/ssr 0.7.0 |
| State | TanStack React Query | 5.90.12 |
| AI | Anthropic Claude SDK | 0.74.0 (claude-sonnet-4-5) |
| CSS | Tailwind CSS | 3.4.1 |
| UI Primitives | Radix UI (shadcn/ui pattern) | Multiple |
| Charts | Recharts | 2.12.3 |
| Error Tracking | Sentry | 10.30.0 |
| Analytics | Vercel Analytics + Speed Insights | Latest |
| Rate Limiting | Vercel KV (Redis) | 3.0.0 |
| Hosting | Vercel | — |

### Folder Structure

```
donna-clean/
├── app/                          # Next.js App Router (pages + API)
│   ├── (dashboard)/              # Route group: CashPulse + ProfitLens
│   ├── (legal)/                  # Route group: Privacy + Terms
│   ├── admin/                    # Admin panel (user management)
│   ├── alerts/                   # Alerts + reminders page
│   ├── analytics/                # CashPulse + ProfitLens analytics
│   ├── api/                      # API routes (Donna AI, health, etc.)
│   │   ├── donna-chat/           # AI chat endpoint (POST/GET)
│   │   ├── donna-insights/       # AI home screen insights (GET/DELETE)
│   │   ├── health/               # Health check endpoint
│   │   ├── business-profile/     # Business bio API
│   │   ├── revalidate/           # ISR revalidation trigger
│   │   └── test-anthropic/       # Dev-only API test
│   ├── auth/                     # Login, signup, password flows
│   ├── entries/                   # Core feature: daily entry CRUD
│   ├── home/                     # Main dashboard home
│   ├── home-v2/                  # Donna AI-first home (experimental)
│   ├── notifications/            # Notification page
│   ├── parties/                  # Customer/vendor server actions
│   ├── profile/                  # User + business profile
│   ├── reminders/                # Reminders server actions
│   ├── settlements/              # Settlement server actions
│   ├── settings/                 # Account settings + delete
│   ├── layout.tsx                # Root layout (providers, analytics)
│   ├── error.tsx                 # Global error boundary
│   ├── client-providers.tsx      # React Query provider
│   ├── globals.css               # Dark purple theme (CSS variables)
│   └── page.tsx                  # Landing page
├── components/                   # 110+ component files
│   ├── ui/                       # 18 shadcn/ui primitives
│   ├── entries/                  # Entry CRUD components
│   ├── settlements/              # Settlement modals + dashboards
│   ├── navigation/               # Bottom nav, top nav, hamburger
│   ├── home/                     # Home page sections
│   ├── home-v2/                  # Donna AI avatar + chat widget
│   ├── dashboard/                # Business snapshot, health score
│   ├── analytics/                # CashPulse + ProfitLens visuals
│   ├── alerts/                   # Alert + reminder dialogs
│   ├── admin/                    # Admin panel components
│   ├── profile/                  # Edit profile, logo upload
│   ├── skeletons/                # Loading skeletons
│   └── [root files]              # Auth forms, cookie consent, etc.
├── lib/                          # 24 utility/logic files
│   ├── supabase/                 # Client + server + middleware + getUser
│   ├── admin/                    # Admin check utility
│   ├── action-wrapper.ts         # Centralized server action security
│   ├── rate-limit.ts             # Vercel KV rate limiter
│   ├── validation.ts             # Comprehensive input validation
│   ├── sanitization.ts           # XSS prevention + input cleaning
│   ├── donna-personality.ts      # AI persona (1000+ lines of prompts)
│   ├── financial-summary.ts      # Compact financial context for AI
│   └── [analytics, date, format utils]
├── utils/supabase/               # Server client factory
├── types/                        # Supabase types + business profile types
├── supabase/                     # 18+ SQL migrations
├── middleware.ts                 # Auth guard + route redirect
├── instrumentation.ts            # Sentry server/edge init
├── sentry.client.config.ts       # Sentry browser config
├── sentry.server.config.ts       # Sentry Node config
├── sentry.edge.config.ts         # Sentry Edge config
├── next.config.ts                # Security headers + Sentry wrapper
└── tailwind.config.ts            # Dark purple theme tokens
```

### Overall Architecture Style

**Server-first with targeted client interactivity.** Pages are async Server Components that fetch data via Supabase, then pass props to Client Component shells for user interaction. Server Actions handle all mutations. API routes are reserved for AI endpoints and system utilities.

- **Server Components:** Page-level data fetching (`home/page.tsx`, `entries/page.tsx`, `admin/page.tsx`)
- **Client Components:** Interactive shells (`entries-shell.tsx`, `alerts-page-client.tsx`), modals, forms, navigation
- **Server Actions:** All CRUD operations (`entries/actions.ts`, `parties/actions.ts`, `settlements/actions.ts`, `auth/actions.ts`)
- **API Routes:** AI chat (`donna-chat/route.ts`), AI insights (`donna-insights/route.ts`), health check, revalidation

---

## 2. Key Patterns Used

### 2.1 Authentication & Protected Routes

**Pattern:** Middleware-level JWT validation + per-page auth guards in Server Components.

**Middleware (`lib/supabase/middleware.ts`):**
```typescript
// Uses getUser() (validates JWT against Supabase server)
// NOT getSession() (which only reads cookies without validation)
const { data: { user } } = await supabase.auth.getUser();

const isProtectedRoute =
  request.nextUrl.pathname.startsWith("/analytics") ||
  request.nextUrl.pathname.startsWith("/home") ||
  request.nextUrl.pathname.startsWith("/entries") ||
  // ...more routes

if (!user && isProtectedRoute) {
  return NextResponse.redirect(new URL("/auth/login", request.url));
}
```

**Page-level guard (`home/page.tsx`):**
```typescript
const { user, initialError } = await getOrRefreshUser(supabase);
if (!user) {
  redirect("/auth/login");
}
```

**Admin guard (`lib/admin/check-admin.ts`):**
```typescript
// Double-check: exact email + app_metadata role
if (user.email !== ADMIN_EMAIL) redirect('/home');
if (user.app_metadata?.role !== 'admin') redirect('/home');
```

**Verdict:** Solid. JWT validation via `getUser()` (not `getSession()`) is the correct pattern. The comment in middleware explicitly documents the security reason. Admin uses belt-and-suspenders approach (email + role). One gap: some protected routes like `/alerts` and `/settings` are missing from the middleware route list — they rely on page-level redirects only.

---

### 2.2 Data Fetching

**Pattern:** Server Actions for all Supabase queries, called from Server Components at page level, passed down as props. `force-dynamic` on all data pages.

**Server-side fetch (`entries/actions.ts`):**
```typescript
export async function getEntries() {
  const supabase = await createSupabaseServerClient();
  const { user } = await getOrRefreshUser(supabase);
  if (!user) return { entries: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from('entries')
    .select(`*, party:parties(name)`)
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })
    .limit(100);
  // ...
}
```

**Page calls actions in parallel (`entries/page.tsx`):**
```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function EntriesPage() {
  const [entriesResult, categoriesResult] = await Promise.all([
    getEntries(),
    getCategories(),
  ]);
  return <EntriesShell initialEntries={entriesResult.entries} ... />;
}
```

**AI Insights caching (`donna-insights/route.ts`):**
The Donna insights API caches AI responses per day in the `profiles` table. On entry creation/update/delete, the cache is invalidated by setting `insights_cache_date` to null.

**Verdict:** Clean pattern — data is fetched on the server, passed as props, and Client Components manage local state from there. The `force-dynamic` + `revalidate = 0` ensures fresh data but means no ISR/static caching benefit. The 100-entry limit on `getEntries()` is a concern for users with many entries over time.

---

### 2.3 Error Handling

**Pattern:** Multi-layer error boundary strategy with Sentry integration.

**Global error boundary (`app/error.tsx`):**
```typescript
'use client';
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html><body>
      <div className="flex min-h-screen items-center justify-center ...">
        <h2>Oops! Something went wrong</h2>
        <button onClick={reset}>Refresh page</button>
      </div>
    </body></html>
  );
}
```

**Route-level error boundary (`entries/error.tsx`):**
```typescript
// Same Sentry pattern but with route-specific messaging
<h2>Entries Error</h2>
<p>Something went wrong loading your entries.</p>
<button onClick={reset}>Try Again</button>
<button onClick={() => window.location.href = '/home'}>Go Home</button>
```

**Server Action error handling (every action):**
```typescript
// All mutations catch errors and report to Sentry
Sentry.captureException(error, {
  tags: { action: 'create-entry', userId: user.id },
  extra: { entryData: sanitizedData },
});
return { success: false, error: error.message };
```

**Verdict:** Excellent. Three layers of error catching (global → route → action). Sentry is properly configured with environment gates, extension filtering, replay masking, and ignore lists. The `instrumentation.ts` also catches uncaught server errors. One gap: not all routes have their own `error.tsx` — analytics and settlements lack route-level boundaries.

---

### 2.4 Loading States & Skeletons

**Pattern:** Next.js `loading.tsx` files + Suspense boundaries with skeleton components.

**Loading file (`entries/loading.tsx`):**
```typescript
import { EntryListSkeleton } from "@/components/skeletons/entry-skeleton";
export default function EntriesLoading() {
  return <EntryListSkeleton />;
}
```

**Suspense in pages (`home/page.tsx`):**
```typescript
<Suspense fallback={<EntryListSkeleton />}>
  <BusinessSnapshot entries={entries} />
</Suspense>
```

**Verdict:** Good basic coverage. The skeleton components exist for entries, cards, and profiles. The `(dashboard)/cashpulse/` and `(dashboard)/profit-lens/` also have `loading.tsx`. Gap: the home page, alerts, and settlements pages lack dedicated loading files.

---

### 2.5 Client vs Server Components

**Pattern:** Pages = Server Components; interactive shells + modals + forms = Client Components.

**`'use client'` is used in:**
- Shell components: `entries-shell.tsx`, `alerts-page-client.tsx`, `home-shell.tsx`
- All modals: `create-entry-modal.tsx`, `edit-entry-modal.tsx`, `settlement-modal.tsx`, etc.
- Navigation: `bottom-nav.tsx`, `top-nav-mobile.tsx`, `hamburger-menu.tsx`
- Forms: `login-form.tsx`, `sign-up-form.tsx`, `forgot-password-form.tsx`
- Providers: `client-providers.tsx` (React Query)
- Error boundaries: `error.tsx`, `entries/error.tsx`
- Analytics components: `cash-pulse-analytics.tsx`, `profit-lens-analytics.tsx`

**Server Components (no directive):**
- All `page.tsx` files (except where noted)
- `layout.tsx` files
- Loading files

**Verdict:** Well-structured. The boundary is drawn correctly — Server Components own data fetching, Client Components own interactivity. No unnecessary `'use client'` on components that don't need it.

---

### 2.6 State Management

**Pattern:** React Query for server state caching + React `useState` for local UI state. No global state store (Redux, Zustand).

**React Query setup (`client-providers.tsx`):**
```typescript
const [queryClient] = useState(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // Fresh for 60s
      gcTime: 5 * 60 * 1000,       // Cache for 5min
      refetchOnWindowFocus: false,   // No refetch on focus
      retry: 1,                      // One retry
    },
  },
}));
```

**Client-side state in shells (`entries-shell.tsx`):**
```typescript
const [entries, setEntries] = useState<Entry[]>(initialEntries);
const [loading, setLoading] = useState(false);
const [currentPage, setCurrentPage] = useState(1);
const [dateFilter, setDateFilter] = useState('this-month');
```

**Verdict:** Practical approach. React Query is configured but appears underutilized — most data fetching goes through Server Actions called on the server, not through `useQuery` hooks. The shell components manage their own state via `useState`. This is fine at current scale but could lead to prop-drilling as complexity grows. No centralized user state — auth is re-checked in every Server Action.

---

### 2.7 Business Logic

#### Cash Entries
The core CRUD is in `app/entries/actions.ts`. Entries have 4 types: `Cash IN`, `Cash OUT`, `Credit`, `Advance`. Categories: `Sales`, `COGS`, `Opex`, `Assets`. Each entry goes through: rate limiting → sanitization → validation → Supabase insert → alert generation → cache invalidation → path revalidation.

#### Settlements
Complex settlement logic handles partial settlements, Credit→Cash conversion, and Advance settlements. Settlement history is tracked in a separate table. Delete cascades correctly to associated settlement entries.

#### Donna AI Chat
Two AI endpoints:
- **`/api/donna-insights`** — Generates 3 home screen bullets. Cached daily in `profiles.cached_insights`. Uses compact financial summary (~400 tokens prompt).
- **`/api/donna-chat`** — Interactive chat with rate limits (10/day, 100/month). Tracks usage per user in `chat_usage` table. Logs token costs in `ai_usage_logs`. Uses 3-month trend data for context.

#### Profiles
Business profile with logo upload, business bio (structured context for AI personalization), and account settings (delete account).

---

### 2.8 UI/Theme Consistency

**Pattern:** Single dark purple theme applied globally via CSS custom properties.

**Theme definition (`globals.css`):**
```css
:root {
  --background: 250 40% 6%;           /* #0f0f1e Dark navy */
  --card: 270 75% 20%;                /* Purple card */
  --primary: 262 51% 47%;             /* #673AB7 */
  --accent: 258 44% 74%;              /* #B39DDB Light purple */
  --positive: 122 39% 49%;            /* #4CAF50 Green */
  --destructive: 4 90% 58%;           /* #F44336 Red */
}
```

**Mobile-first navigation (`bottom-nav.tsx`):**
```typescript
<nav className="fixed bottom-0 left-0 right-0 z-50 ... h-24 md:hidden">
  {/* 5 tabs: Home, Entries, Cashpulse, Profit Lens, Alerts */}
</nav>
```

**Verdict:** Consistent dark purple theme throughout. Mobile-first with bottom nav (hidden on desktop with `md:hidden`). The `h-24` bottom nav is generously sized for touch targets. All pages use `pb-24 md:pb-8` to account for the nav bar. The viewport is locked (`userScalable: false`) which can be an accessibility concern but prevents zoom issues on mobile forms.

---

## 3. Full File Inventory (Critical Files)

### `app/` — Pages & Routing

| File | Type | Description | Notes |
|------|------|-------------|-------|
| `layout.tsx` | Layout (Server) | Root layout with providers, analytics, cookie consent | Good: SEO metadata, speed insights |
| `page.tsx` | Page (Server) | Landing page | — |
| `error.tsx` | Error Boundary (Client) | Global error handler with Sentry | Good: Sentry + user-friendly message |
| `client-providers.tsx` | Provider (Client) | React Query provider with sensible defaults | Good: staleTime/gcTime configured |
| `globals.css` | Styles | Dark purple CSS variables theme | Good: consistent token system |
| `metadata.ts` | Config (Server) | SEO metadata exports | — |
| **auth/** | | | |
| `auth/actions.ts` | Server Actions | Login, signup, logout, forgot/update password | Good: sanitization on all inputs |
| `auth/login/page.tsx` | Page (Server) | Login form page | — |
| `auth/sign-up/page.tsx` | Page (Server) | Registration page | — |
| `auth/confirm/route.ts` | Route Handler | Email confirmation callback | — |
| `auth/layout.tsx` | Layout (Server) | Auth pages layout | — |
| **entries/** | | | |
| `entries/page.tsx` | Page (Server) | Fetches entries + categories, renders shell | Good: parallel fetching |
| `entries/actions.ts` | Server Actions | getEntries, createEntry, updateEntry, deleteEntry | Good: full security pipeline |
| `entries/loading.tsx` | Loading (Server) | Skeleton while entries load | Good practice |
| `entries/error.tsx` | Error Boundary (Client) | Route-level error with Sentry | Good: retry + go home |
| **home/** | | | |
| `home/page.tsx` | Page (Server) | Main dashboard with greeting, insights, snapshot | Flag: `force-dynamic` disables caching |
| **admin/** | | | |
| `admin/page.tsx` | Page (Server) | Admin dashboard (requires admin role) | Good: admin check |
| `admin/layout.tsx` | Layout (Server) | Admin layout with guard | — |
| `admin/users/manage/page.tsx` | Page (Server) | User management | — |
| `admin/users/monitor/page.tsx` | Page (Server) | User activity monitoring | — |
| **analytics/** | | | |
| `analytics/cashpulse/page.tsx` | Page (Server) | Cash flow analytics | — |
| `analytics/profitlens/page.tsx` | Page (Server) | Profit/loss analytics | — |
| `analytics/layout.tsx` | Layout (Server) | Analytics layout | — |
| `analytics/error.tsx` | Error Boundary (Client) | Analytics error boundary | Good practice |
| **api/** | | | |
| `api/donna-chat/route.ts` | API Route | AI chat with rate limiting + usage tracking | Good: daily/monthly limits, cost logging |
| `api/donna-insights/route.ts` | API Route | AI home screen bullets with daily caching | Good: cache in DB, invalidate on entry change |
| `api/health/route.ts` | API Route | Health check (DB connectivity) | Good: exists for monitoring |
| `api/revalidate/route.ts` | API Route | ISR revalidation trigger | — |
| **settlements/** | | | |
| `settlements/actions.ts` | Server Actions | Settlement CRUD with partial settlement logic | Complex but thorough |
| `settlements/settlement-history-actions.ts` | Server Actions | Settlement history queries | — |
| **Other pages** | | | |
| `alerts/page.tsx` | Page (Server) | Alerts + reminders management | Flag: no loading.tsx |
| `profile/page.tsx` | Page (Server) | User profile page | — |
| `profile/business-bio/page.tsx` | Page (Server) | Business bio for AI personalization | — |
| `settings/page.tsx` | Page (Server) | Account settings (delete account) | — |
| `parties/actions.ts` | Server Actions | Customer/vendor CRUD | — |
| `reminders/actions.ts` | Server Actions | Reminders CRUD | — |

### `components/` — UI Components

| File | Type | Description | Notes |
|------|------|-------------|-------|
| **ui/** (18 files) | | | |
| `ui/button.tsx` | Client | shadcn/ui Button with CVA variants | Good: variant system |
| `ui/card.tsx` | Client | Card component | — |
| `ui/dialog.tsx` | Client | Radix Dialog wrapper | — |
| `ui/skeleton.tsx` | Client | Skeleton loading primitive | — |
| `ui/toaster.tsx` | Client | Sonner toast wrapper | — |
| `ui/error-state.tsx` | Client | Reusable error state with retry | Good: reusable |
| `ui/empty-state.tsx` | Client | Reusable empty state | Good: reusable |
| **entries/** (8 files) | | | |
| `entries/entries-shell.tsx` | Client | Main entries page shell: form + filters + list + pagination | Flag: 600 lines, consider splitting |
| `entries/entry-list.tsx` | Client | Entry list rendering with swipe actions | — |
| `entries/create-entry-modal.tsx` | Client | Create entry modal form | — |
| `entries/edit-entry-modal.tsx` | Client | Edit entry modal form | — |
| `entries/entry-details-modal.tsx` | Client | View entry details | — |
| `entries/delete-entry-dialog.tsx` | Client | Delete confirmation dialog | — |
| `entries/party-selector.tsx` | Client | Party autocomplete/select | — |
| `entries/entry-filters.tsx` | Client | Filter controls | — |
| **settlements/** (8 files) | | | |
| `settlements/settlement-modal.tsx` | Client | Generic settlement modal | — |
| `settlements/customer-settlement-modal.tsx` | Client | Customer-specific settlement | — |
| `settlements/vendor-settlement-modal.tsx` | Client | Vendor settlement | — |
| `settlements/advance-settlement-modal.tsx` | Client | Advance settlement | — |
| `settlements/pending-*-dashboard.tsx` | Client | Pending collections/bills/advances views | — |
| **navigation/** (5 files) | | | |
| `navigation/bottom-nav.tsx` | Client | Mobile bottom tab bar (5 tabs) | Good: `prefetch={true}` |
| `navigation/top-nav-mobile.tsx` | Client | Mobile top bar | — |
| `navigation/desktop-nav.tsx` | Client | Desktop sidebar nav | — |
| `navigation/hamburger-menu.tsx` | Client | Mobile hamburger menu | — |
| **home/** (5 files) | | | |
| `home/greeting-section.tsx` | Client | Time-based greeting | — |
| `home/business-insights.tsx` | Client | AI-powered insights display | — |
| `home/alerts-section.tsx` | Client | Alerts preview on home | — |
| **home-v2/** (8 files) | | | |
| `home-v2/donna-chat-widget.tsx` | Client | AI chat floating widget | — |
| `home-v2/donna-avatar*.tsx` | Client | Donna avatar in 3 sizes | — |
| **dashboard/** (3 files) | | | |
| `dashboard/business-snapshot.tsx` | Client | Financial overview cards | — |
| `dashboard/financial-health-dashboard.tsx` | Client | Health score visualization | — |
| **Other** | | | |
| `auth-session-keeper.tsx` | Client | Session keepalive component | — |
| `cookie-consent.tsx` | Client | GDPR cookie consent banner | Good: compliance |
| `error-boundary.tsx` | Client | React error boundary class component | — |
| `site-header.tsx` | Server | Desktop header with nav | — |

### `lib/` — Business Logic & Utilities

| File | Description | Notes |
|------|-------------|-------|
| `supabase/client.ts` | Browser Supabase client factory | Good: uses createBrowserClient |
| `supabase/server.ts` | Server Supabase client re-export | — |
| `supabase/get-user.ts` | Validated user getter (getUser not getSession) | Good: security-conscious |
| `supabase/middleware.ts` | Session management + route protection | Good: correct JWT validation |
| `admin/check-admin.ts` | Admin email + role guard | Good: two-factor check |
| `action-wrapper.ts` | Centralized: rate limit → validate → sanitize → Sentry | Good: DRY security |
| `rate-limit.ts` | Vercel KV rate limiter with configurable limits | Good: graceful degradation if KV down |
| `validation.ts` | Full validation suite (amount, date, entry type, etc.) | Good: comprehensive |
| `sanitization.ts` | XSS prevention, string/number/date sanitization | Good: thorough |
| `donna-personality.ts` | AI persona: 1000+ lines of prompt engineering | Impressive: culturally grounded |
| `financial-summary.ts` | Compact financial context builder for AI | Good: token-efficient |
| `analytics-new.ts` | Analytics calculations | — |
| `calculate-health-score.ts` | Financial health scoring algorithm | — |
| `profit-calculations-new.ts` | Profit/loss calculation logic | — |
| `date-utils.ts` | Date formatting and period calculations | — |
| `format-number-words.ts` | Number to Indian word format | — |
| `category-mapping.ts` | Entry type → category mappings | — |
| `icon-mappings.ts` | Category → icon selections | — |
| `event-tracking.ts` | Analytics event wrapper | — |
| `toast.ts` | Toast notification helpers | — |
| `utils.ts` | `cn()` utility (clsx + tailwind-merge) | Standard |
| `entries.ts` | Entry type definitions | — |
| `parties.ts` | Party utilities | — |
| `alert-system.ts` | Alert generation logic | — |

### Config & Infrastructure Files

| File | Description | Notes |
|------|-------------|-------|
| `middleware.ts` | Route middleware (auth + redirects) | Good: correct matcher pattern |
| `next.config.ts` | Security headers + Sentry (prod only) | Good: HSTS, X-Frame, CSP basics |
| `instrumentation.ts` | Sentry server/edge initialization | Good: runtime detection |
| `sentry.client.config.ts` | Client Sentry with replay + filtering | Good: masks text, blocks media |
| `tailwind.config.ts` | Theme tokens + animations | — |
| `.env.example` | Environment variable template | Good: documented |
| `supabase-setup.sql` | Initial DB schema | — |

---

## 4. Production Readiness Score

### Overall: 7.2 / 10

This is a well-architected app that already handles many production concerns correctly. The gaps are mostly around scale, edge cases, and operational maturity.

---

### 4.1 Scalability — 6.5/10

**What's good:**
- Server-side rendering keeps client bundles lean
- Rate limiting via Vercel KV is horizontally scalable
- AI insights are cached daily per user, not re-generated on every page load

**Improvements needed:**
1. **`getEntries()` returns max 100 rows** — A business with 10 entries/day will exceed this in ~2 weeks. Need cursor-based pagination at the server action level, not just client-side page slicing.
2. **`generateAlertsForEntry()` fetches ALL entries** on every entry creation to calculate balances — this is O(n) per write. At 1000 users × 10 entries/day = 10K alert calculations daily, each scanning the full entries table. Move balance calculations to a materialized view or summary table.
3. **`buildFinancialSummary()` runs 5 separate Supabase queries** for one AI prompt — combine into fewer queries or use a Postgres function/view.

---

### 4.2 Error Resilience — 8/10

**What's good:**
- Global + route-level error boundaries with Sentry
- Server Action error handling with structured responses
- Rate limiter gracefully degrades if KV is down
- AI insights have fallback bullets if Claude fails
- Sentry filters browser extensions, ResizeObserver noise, AbortErrors

**Improvements needed:**
1. **Missing error boundaries** on `/alerts`, `/settings`, `/profile`, and settlement pages — a crash here shows the generic global error instead of a contextual recovery option.
2. **No retry logic on Supabase queries** — transient network errors in Server Actions will fail immediately. Add a single retry with backoff for reads.

---

### 4.3 Performance — 6.5/10

**What's good:**
- Server Components for data-heavy pages
- `prefetch={true}` on bottom nav links
- React Query configured with 60s staleTime to prevent redundant fetches
- AI insights cached daily (avoids Claude API call on every page load)

**Improvements needed:**
1. **All data pages use `force-dynamic` + `revalidate = 0`** — this means every page request hits Supabase fresh. For the home page dashboard, a 30-60s `revalidate` would dramatically reduce DB load with acceptable staleness.
2. **No `loading.tsx` for `/home`, `/alerts`, `/profile`** — users see a blank screen during server fetch.
3. **`entries-shell.tsx` is 600+ lines** of Client Component with complex filter state — consider code-splitting the form and filters into separate lazy-loaded components.

---

### 4.4 Security — 8.5/10

**What's good:**
- JWT validation via `getUser()` (not `getSession()`) — explicitly documented in code
- Input sanitization on all user inputs (HTML stripping, XSS escaping)
- Comprehensive validation (amount limits, date ranges, entry types)
- Rate limiting on all mutations and auth endpoints
- Security headers: HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy
- Admin uses two-factor check (email + role)
- AI prompts sanitize output (strip code blocks, fix negative numbers)
- Sentry masks text and blocks media in replays

**Improvements needed:**
1. **`/alerts` and `/settings` not in middleware protected routes** — they rely on page-level guards only. Add them to the middleware `isProtectedRoute` check.
2. **No Content Security Policy (CSP) header** — add `Content-Security-Policy` to `next.config.ts` headers to prevent script injection.
3. **`SUPABASE_SERVICE_ROLE_KEY` used in API routes** for admin logging — ensure this is never exposed to the client. Currently looks safe (only in route handlers).

---

### 4.5 Maintainability — 7/10

**What's good:**
- Clear separation: pages fetch, shells interact, actions mutate
- Consistent file naming conventions
- Types generated from Supabase schema
- Shared utilities for validation, sanitization, toast, etc.
- `action-wrapper.ts` provides DRY security for server actions

**Improvements needed:**
1. **`entries-shell.tsx` at 600+ lines** is the biggest maintenance risk — form, filters, pagination, export are all in one file. Split into `<EntryForm />`, `<EntryFilters />`, `<EntryPagination />`.
2. **Some duplication between `lib/supabase/server.ts` and `utils/supabase/server.ts`** — two files export the same server client. Consolidate to one canonical path.
3. **`sanitization.ts` has an in-memory rate limiter** (`rateLimitStore`) that doesn't work in serverless — the real rate limiter in `rate-limit.ts` (Vercel KV) is used instead, but the dead code in sanitization.ts is confusing. Remove it.
4. **Two home page implementations** (`/home` and `/home-v2`) — tech debt. Decide and remove one.

---

### 4.6 Mobile Experience — 8/10

**What's good:**
- Bottom nav with large 56px (h-14) touch targets
- `pb-24` padding on all pages to clear the bottom nav
- Mobile-first responsive design (mobile default, `md:` breakpoint for desktop)
- Viewport locked to prevent zoom issues on forms
- Dark theme is easy on eyes for long use sessions

**Improvements needed:**
1. **`userScalable: false` in viewport** — this is an accessibility concern. Some users with vision impairments need to zoom. Consider removing this and handling zoom issues with `input { font-size: 16px }` instead.
2. **Date inputs** — native `<input type="date">` renders differently across Android browsers (especially Chrome vs WebView). Consider using `react-day-picker` consistently.
3. **No offline support or PWA manifest** — shop owners in India may have intermittent connectivity. Adding a service worker with basic offline caching would help.

---

## 5. Actionable Production Roadmap

### HIGH Priority (Do Before Launch)

#### H1. Add missing routes to middleware protection
**Files:** `lib/supabase/middleware.ts`
```typescript
const isProtectedRoute =
  request.nextUrl.pathname.startsWith("/analytics") ||
  request.nextUrl.pathname.startsWith("/home") ||
  request.nextUrl.pathname.startsWith("/entries") ||
  request.nextUrl.pathname.startsWith("/dashboard") ||
  request.nextUrl.pathname.startsWith("/admin") ||
  request.nextUrl.pathname.startsWith("/profile") ||
  request.nextUrl.pathname.startsWith("/settlements") ||
  request.nextUrl.pathname.startsWith("/alerts") ||      // ADD
  request.nextUrl.pathname.startsWith("/settings") ||     // ADD
  request.nextUrl.pathname.startsWith("/notifications") || // ADD
  request.nextUrl.pathname.startsWith("/parties");         // ADD
```

#### H2. Implement server-side pagination for entries
**Files:** `app/entries/actions.ts`, `components/entries/entries-shell.tsx`

Replace the current approach (fetch 100, slice client-side) with cursor-based pagination:
```typescript
export async function getEntries(page: number = 1, pageSize: number = 20) {
  // ...auth check...
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('entries')
    .select('*, party:parties(name)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })
    .range(from, to);

  return { entries: data, total: count, error: null };
}
```

#### H3. Add loading.tsx to missing routes
**Files to create:**
- `app/home/loading.tsx`
- `app/alerts/loading.tsx`
- `app/profile/loading.tsx`
- `app/settings/loading.tsx`

Each should use an appropriate skeleton component.

#### H4. Add Content Security Policy header
**File:** `next.config.ts`
```typescript
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co https://*.sentry.io https://*.vercel-analytics.com https://api.anthropic.com; font-src 'self';"
}
```

#### H5. Optimize `generateAlertsForEntry()` — eliminate full table scan
**File:** `app/entries/actions.ts`

Replace the full `entries` table scan with a summary query:
```typescript
// Instead of fetching ALL entries:
const { data: summary } = await supabase.rpc('get_user_balance_summary', {
  p_user_id: userId
});
// Create a Postgres function that returns pre-aggregated totals
```

#### H6. Remove dead in-memory rate limiter from sanitization.ts
**File:** `lib/sanitization.ts`

Delete lines 273-315 (the `rateLimitStore` Map and associated functions `isRateLimited`, `resetRateLimit`). The real rate limiter is in `lib/rate-limit.ts` using Vercel KV.

---

### MEDIUM Priority (Do Within First Month)

#### M1. Split `entries-shell.tsx` into smaller components
**File:** `components/entries/entries-shell.tsx` (607 lines)

Split into:
- `components/entries/entry-form.tsx` — The create entry form (~150 lines)
- `components/entries/entry-filters.tsx` — Date/type filter controls (~80 lines)
- `components/entries/entry-pagination.tsx` — Pagination controls (~40 lines)
- `components/entries/entries-shell.tsx` — Orchestrator only (~200 lines)

#### M2. Add error boundaries to remaining routes
**Files to create:**
- `app/alerts/error.tsx`
- `app/profile/error.tsx`
- `app/settings/error.tsx`
- `app/settlements/error.tsx` (if applicable)

Use the same Sentry pattern as `entries/error.tsx`.

#### M3. Consolidate duplicate Supabase server client exports
**Action:** Delete `utils/supabase/server.ts` and update all imports to use `lib/supabase/server.ts`, or vice versa. Pick one canonical path.

#### M4. Remove home-v2 or home — pick one
**Files:** Either delete `app/home-v2/` and `components/home-v2/` entirely, or promote it to `/home` and remove the old version. Having both creates confusion and dead code.

#### M5. Add retry logic to Supabase reads in Server Actions
**File:** `lib/supabase/server.ts` or a new `lib/supabase/query.ts`
```typescript
export async function queryWithRetry<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  maxRetries = 1
): Promise<{ data: T | null; error: any }> {
  let lastError;
  for (let i = 0; i <= maxRetries; i++) {
    const result = await queryFn();
    if (!result.error) return result;
    lastError = result.error;
    if (i < maxRetries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
  }
  return { data: null, error: lastError };
}
```

#### M6. Consider ISR for home page instead of force-dynamic
**File:** `app/home/page.tsx`

Change from:
```typescript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
```
To:
```typescript
export const revalidate = 30; // Revalidate every 30 seconds
```
This reduces Supabase load dramatically while keeping data reasonably fresh.

#### M7. Add PWA manifest and basic offline support
**Files to create:**
- `public/manifest.json` — PWA manifest with app name, icons, theme color
- `public/sw.js` — Basic service worker for offline caching of static assets

This is critical for Indian shop owners with intermittent connectivity.

---

### LOW Priority (Post-Launch Improvements)

#### L1. Remove `userScalable: false` from viewport
**File:** `app/layout.tsx`
```typescript
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,       // Allow zoom for accessibility
  userScalable: true,     // CHANGED from false
};
```
Add `font-size: 16px` to input elements to prevent iOS auto-zoom.

#### L2. Add database indexes for common queries
**Migration file:** Check that these indexes exist in Supabase:
```sql
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_entries_user_settled ON entries(user_id, settled) WHERE settled = false;
CREATE INDEX IF NOT EXISTS idx_reminders_user_status ON reminders(user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_chat_usage_user_date ON chat_usage(user_id, date);
```

#### L3. Add end-to-end tests for critical flows
**Priority test paths:**
1. Sign up → verify email → login → create first entry → see it on home
2. Create entry → edit → delete → verify dashboard updates
3. Create Credit entry → partial settlement → full settlement
4. Donna chat: send message → see response → verify rate limit

#### L4. Add structured logging
Replace `console.error` calls with a structured logger that includes user ID, action, and timestamp consistently. Consider Vercel Log Drain or a lightweight logging library.

#### L5. Add uptime monitoring
**File:** The `/api/health` endpoint already exists. Configure:
- Vercel Cron or external service (UptimeRobot) to ping `/api/health` every 5 minutes
- Alert on consecutive failures via Slack/email

#### L6. Reduce Supabase queries in `buildFinancialSummary()`
**File:** `lib/financial-summary.ts`

Currently runs 5 separate queries. Combine into a single Postgres function:
```sql
CREATE FUNCTION get_financial_summary(p_user_id UUID, p_month_start DATE, p_month_end DATE, ...)
RETURNS TABLE(month_in NUMERIC, month_out NUMERIC, week_in NUMERIC, ...)
```

---

## Summary

| Category | Score | Status |
|----------|-------|--------|
| Scalability | 6.5/10 | Needs pagination + query optimization |
| Error Resilience | 8.0/10 | Strong Sentry setup, missing some route boundaries |
| Performance | 6.5/10 | All force-dynamic, missing loading states |
| Security | 8.5/10 | Excellent fundamentals, needs CSP + route coverage |
| Maintainability | 7.0/10 | Good patterns, some dead code + large files |
| Mobile Experience | 8.0/10 | Strong, needs PWA + accessibility tweaks |
| **Overall** | **7.2/10** | **Solid foundation. 6-8 targeted fixes make this production-ready.** |

### Bottom Line

The Donna is built on strong architectural foundations — correct auth patterns, proper Server Component boundaries, comprehensive input validation, real rate limiting, and thoughtful error handling. The AI integration (Donna persona) is particularly well-engineered with culturally grounded prompts and efficient caching.

The critical gaps are around **scale** (pagination, query optimization) and **operational completeness** (missing loading states, error boundaries on secondary pages, CSP header). These are all fixable within 1-2 focused sprints.

For 1000+ daily users, prioritize H1-H5 immediately, then M1-M7 within the first month. The app is closer to production-ready than most early-stage SaaS codebases I've audited.
