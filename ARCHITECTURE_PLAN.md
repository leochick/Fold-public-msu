# Fold-Public — Senior-Engineer Architecture Plan

A ranked punch list of what would move this codebase from "vibe-coded but it works" to "intentionally architected." Items are grouped by effort, with the highest-leverage change called out at the end.

The goal is not to apply every item — it's to know which ones a senior reviewer would notice and decide which signal you want to send.

> **Status (2026-05-19):** all 12 items have been applied in this branch. Item #9 has both its own commit and its own migration (drizzle 0007) — see that section.

---

## Quick wins — a weekend's work, big "well-written" payoff

### 1. Stop copy-pasting the auth check in every API route

Twenty-plus routes start with:

```ts
const user = await getCurrentUser();
if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
```

Wrap it in a `withAuth(handler)` higher-order function so the route body is just the actual logic. The same pattern cleans up the inline `if (isDemoMode()) return mockX()` blocks scattered across the AI routes. One helper, one place to change, zero copy-paste.

**Impact:** removes ~150 lines, makes route files legible at a glance, prevents future routes from forgetting the check.

### 2. Add input validation with zod

Routes today do `(await req.json()) as { text?: string }` and then check fields by hand. Replace with:

```ts
const body = bodySchema.parse(await req.json());
```

Free runtime validation, typed access, and 400-with-reason errors without writing them. Same trick for an `src/lib/env.ts` that fails fast at boot if `TURSO_DATABASE_URL` is missing instead of blowing up on the first DB query.

**Impact:** eliminates a class of "weird body shape crashed the route" bugs and gives reviewers something to point at as "this codebase takes input seriously."

### 3. Coalesce the dashboard queries

`src/app/page.tsx` fires 8+ sequential Drizzle queries on every load. Wrap them in `await Promise.all([...])` and several drop to one round trip. The real win is a single SQL with CTEs for the snapshot stats, but parallel-await alone is a meaningful latency cut.

**Impact:** dashboard load time drops noticeably, especially over a slow Turso region.

### 4. Extract AI prompts and tool definitions into `src/lib/prompts/`

System prompts and `Anthropic.Tool` schemas live inline in route files, sometimes 80+ lines of prose. Pulled out, the routes become 20 lines each, prompts become reviewable and testable, and you can A/B them later.

**Impact:** route files shrink dramatically; prompts become first-class artifacts you can version.

---

## Medium-effort — a week, real architectural improvement

### 5. Add tests

Anyone senior opens the repo and the first thing they look for is `__tests__/` or `*.test.ts`. Even a thin Vitest setup with:

- One e2e test for the auth flow
- One happy-path test per AI route (with a mocked Anthropic client)
- Snapshot tests for `filter-to-sql.ts`

This single change shifts impression more than any other.

### 6. Add CI

A `.github/workflows/ci.yml` that runs `npm run build`, `npm test`, and `tsc --noEmit` on every PR. Free quality bar, signals discipline.

### 7. Pagination on `/students` and `/feedback`

Loading the entire roster is fine for SeattleU's size but breaks at 500+ students. Cursor-based or page-based, doesn't matter — just pick one.

### 8. Stream AI responses

The Anthropic SDK supports streaming. For Modify, Ask, and Insights, streaming tokens to the UI makes the app feel an order of magnitude more responsive. Right now you wait 5–10 seconds staring at a spinner.

---

## Big rewrites — where the architecture argument actually gets made

### 9. Replace roll-your-own auth with Better Auth

**Lucia was archived in 2025**, so we went with **Better Auth** — the active replacement with first-class Next.js + Drizzle support. Clerk would be the right choice for hosted UI + MFA + social login; Auth.js v5's credentials provider is awkward enough to skip.

What landed in `drizzle/migrations/0007_groovy_captain_stacy.sql`:
- Added `account` + `verification` tables (Better Auth's required schema).
- Added `email_verified`, `image`, `updated_at` to `users`, made `password_hash` nullable.
- Added `token`, `created_at`, `updated_at`, `ip_address`, `user_agent` to `sessions`, plus a unique index on `token`.
- Backfilled `token = id` on existing sessions and inserted `account` rows with the existing bcrypt `password_hash` so existing users keep their passwords.

Code-side wiring:
- `src/lib/better-auth.ts` instantiates Better Auth with a Drizzle adapter pointing at the existing `users` / `sessions` tables via `modelName` + field-mapping (`name → displayName`). `bcryptjs` is plugged in as the password hasher so backfilled hashes verify on first login.
- `src/lib/auth.ts` now delegates to `auth.api.getSession`; the `getCurrentUser()` surface is unchanged so the 22 routes don't care.
- `src/app/login/page.tsx` + `signup/page.tsx` call `auth.api.signInEmail` / `signUpEmail`.
- `src/app/actions.ts` uses `auth.api.signOut`.
- `src/middleware.ts` checks for `fold.session_token` cookie (BA default with our `cookiePrefix: "fold"`).
- Cron-style smoke scripts that minted sessions directly were updated to fill in the new `token` column.

Caveats:
- The cookie name changed (`fold_session` → `fold.session_token`), so any users with active cookies at the time of the migration will be forced to re-login.
- The DEMO mode path in `getCurrentUser` is unchanged — public demo users still hit the first user in the DB without going through Better Auth.

### 10. Add observability

Sentry for errors, Vercel Analytics or PostHog for page views, structured logs with request IDs. Right now production failures are silent — you only know something broke when a user tells you on `/feedback`.

### 11. Type-safe API layer (zod-derived or tRPC)

Today the client does `fetch().then(r => r.json() as Something)` — a cast, not a type. With tRPC you call `api.events.list.useQuery()` and inputs and outputs are typed end to end. This is the single change that most loudly signals "the person who built this thinks about contracts."

### 12. Move heavy logic from `src/app/api/*/route.ts` to a `src/server/` layer

The route file should be a thin HTTP shell; the business logic (parsing, AI calls, DB writes) should live in a service module that's testable in isolation. Right now `intake/parse/route.ts` is 170 lines mixing HTTP concerns with domain logic.

---

## What to do first

If you want **one change** that single-handedly shifts the impression from "vibe-coded" to "intentional," it's this trio:

1. **zod for input validation** (item #2)
2. **Extracted AI prompts in `src/lib/prompts/`** (item #4)
3. **A `withAuth` higher-order handler** (item #1)

That cuts the codebase by 20–30%, makes each remaining route legible at a glance, and signals architectural thinking without requiring you to learn a new framework.

After that, **tests + CI** (items #5 and #6) is the next biggest leverage point. Test coverage is what most reviewers actually grep for first.

---

## Items deliberately not on this list

A few things you might expect to see that I'd skip for this codebase:

- **Microservices / queue infrastructure.** Total overkill at this scale; would actively make the architecture worse.
- **Redis cache.** Turso reads are cheap and the dashboard data is fine to recompute per request.
- **Custom design system.** The Tailwind utility classes are already consistent enough; the cost-benefit doesn't pencil out.
- **GraphQL.** tRPC is the right tradeoff for an internal app with one client; GraphQL adds tooling weight without payoff.

---

## How to use this document

Pick 1–3 items, do them well, commit each as a self-contained PR. Don't try to land all of this in one session — that's exactly the kind of thing that signals "tried to do too much" rather than "thought carefully about each change."

If you want me to implement any specific item, point at the number and I'll do it.
