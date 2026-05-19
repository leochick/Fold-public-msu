# Fold

**Event management, ride coordination, and attendee analytics for student organizations, powered by AI.**

Fold helps campus ministries and student groups track who shows up, who invites whom, and how to follow up, all from a single dashboard. Paste messy attendance lists, ask questions in plain English, and let AI handle the parsing.

## What it does

- **Dashboard** -- 30-day snapshot at a glance: events hosted, total check-ins, unique attendees, and new students. Interactive charts show attendance trends, engagement funnels, and demographic breakdowns.
- **Events** -- create events, mark attendance with a quick-add form, and view per-event breakdowns (first-timers vs returners, invite chains, gender split).
- **Students** -- searchable roster with health metrics per person: attendance frequency, who invited them, who they've brought, and how many contact attempts have been made. A "Gone Cold" tab surfaces students who haven't shown up in 30+ days.
- **Smart Intake** -- paste unstructured text (names, phone numbers, Instagram handles, however you collected it) and AI extracts structured student records. Duplicate detection built in.
- **Engagement Funnel** -- track students across stages from "new" to "engaged." Filter by stale responses, missing contact attempts, or inactive status. Automated sweep moves students between stages based on activity.
- **Ride Coordination** -- create carpool sessions per event (there, back, Sunday morning), assign drivers and riders, and manage seat constraints.
- **Natural Language Queries** -- ask questions like "who came to the last 3 events but not this week" or "all freshmen who were invited by someone" and get results back as a table.

## Tech Stack

- **Next.js 15** (App Router, Turbopack)
- **Turso** (hosted SQLite) + Drizzle ORM
- **Claude API** (Haiku for parsing and insights)
- **Tailwind CSS** + Recharts
- **TypeScript** end-to-end

## Getting Started

```bash
# Clone and install
git clone https://github.com/andrewyu47/Fold-public.git
cd Fold-public
npm install

# Configure environment
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY, TURSO_DATABASE_URL, and TURSO_AUTH_TOKEN

# Create a Turso database (free tier)
# turso db create fold
# turso db tokens create fold

# Set up the database
npx tsx scripts/migrate.ts
npx tsx scripts/seed.ts

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `admin@example.com` / `password123`.

## Authentication

Fold uses **per-person email + password** accounts (bcrypt-hashed, cookie sessions, 30-day TTL). There is no SSO, OAuth, or magic-link option.

- Each user signs up at `/signup` with their own email and password.
- Set `ALLOWED_DOMAIN=yourchurch.org` to restrict signups to a single email domain. Leave it blank to allow any email.
- The seed creates an initial `admin@example.com` / `password123` account. **Change the password (or delete the user) before going to production.**
- `AUTH_SECRET` should be a long random string. Generate one with `openssl rand -hex 32`.

## Deploying Your Own Copy

The easiest path for a single ministry or student group is to fork this repo and deploy your own instance. Your data stays in your own Turso database; your Anthropic key is yours.

> **Not technical?** [`SELF_HOST.md`](./SELF_HOST.md) is a single file you can paste into Claude or ChatGPT to get walked through the whole setup, top to bottom.

### Option A — Vercel (recommended)

1. **Fork** this repo on GitHub.
2. **Create a Turso database** (free tier):
   ```bash
   brew install tursodatabase/tap/turso   # or see https://docs.turso.tech
   turso auth signup
   turso db create fold
   turso db show fold --url               # → TURSO_DATABASE_URL
   turso db tokens create fold            # → TURSO_AUTH_TOKEN
   ```
3. **Import the fork into Vercel** at [vercel.com/new](https://vercel.com/new). Framework preset auto-detects as Next.js.
4. **Add environment variables** in the Vercel project settings:
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
   - `AUTH_SECRET` — `openssl rand -hex 32`
   - `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` — from step 2
   - `ALLOWED_DOMAIN` (optional) — e.g. `yourchurch.org`
5. **Deploy.** After the first build, run the migration once against your Turso DB from your local machine:
   ```bash
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate.ts
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/seed.ts
   ```
6. Visit your Vercel URL, sign in with the seed account, change the password, and invite your team to sign up.

### Option B — Cloudflare Pages

Cloudflare Pages can run Next.js via the official adapter. Slightly more setup than Vercel.

1. Fork the repo and provision Turso the same way as above.
2. Install the Cloudflare adapter in your fork:
   ```bash
   npm install --save-dev @cloudflare/next-on-pages
   ```
3. In **Cloudflare → Workers & Pages → Create → Pages → Connect to Git**, pick your fork.
4. Build settings:
   - **Build command:** `npx @cloudflare/next-on-pages@1`
   - **Build output directory:** `.vercel/output/static`
   - **Compatibility flags:** `nodejs_compat`
5. Add the same environment variables as the Vercel section.
6. Run the migration/seed scripts against your Turso DB from your local machine (same commands as above).

> **Note:** If you hit issues with Node-only APIs on Cloudflare's edge runtime, Vercel is the smoother path. The codebase is tested primarily on Node-runtime Next.js.

### Custom domain

Both Vercel and Cloudflare let you attach a custom domain in the project settings — point a CNAME from your DNS provider to the platform's target and you're done.

## Configuration

| Variable | Description | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key (required for AI features) | -- |
| `AUTH_SECRET` | Session signing secret | -- |
| `TURSO_DATABASE_URL` | Turso database URL | -- |
| `TURSO_AUTH_TOKEN` | Turso auth token | -- |
| `ALLOWED_DOMAIN` | Restrict signups to a specific email domain | any |
| `HOST` | Bind address | `127.0.0.1` |

## Project Structure

```text
src/
  app/           # Next.js pages and API routes
    api/         # Backend endpoints (intake, rides, funnel, query)
    events/      # Event CRUD and attendance
    students/    # Student profiles and contact logs
    funnel/      # Engagement pipeline
    query/       # Natural language search
  lib/           # Shared utilities
    rides/       # Carpool solver and constraints
    funnel/      # Stage management and dedup
  components/    # Reusable UI (RideSessionEditor)
drizzle/         # Schema and migrations
scripts/         # Seed data, dev fixtures, smoke tests
```

## License

MIT
