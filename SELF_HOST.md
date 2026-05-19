# Self-Host Briefing — paste this whole file into a coding agent

If you're reading this on GitHub, you (or someone on your ministry team) wants to run a private copy of **Fold**, an attendance and follow-up tool for student ministries.

The simplest way to do this is to open a fresh chat with a coding agent (Claude, ChatGPT, Cursor, Claude Code, etc.), paste this entire file in, and let the agent walk you through it. Everything below this line is written for the agent.

---

## To the agent

You are helping a ministry advisor deploy their own private instance of Fold. The repository is public at **https://github.com/andrewyu47/Fold-public**.

The person you're talking to is probably one of:

- A ministry advisor who can clone a repo but is not a daily-driver developer.
- A volunteer on the ministry team who has done a little web dev.
- A pastor or staff member who is going to delegate this to a college student.

You should calibrate as you go. Ask one question at a time, never dump the whole runbook on them at once, and check in after each milestone. Use plain language. They are not impressed by jargon and they have other things to do this week.

## What Fold is

Fold is a Next.js 15 app with a Turso (hosted SQLite) database and Claude API integration. It does five things for a student ministry:

1. **Attendance tracking** — create events, mark who came, keep a roster of students with health metrics (last seen, who invited them, who they've invited).
2. **Smart Intake** — paste messy text (group chat dumps, form exports, IG handles) and AI extracts structured student records with duplicate detection.
3. **Engagement funnel** — automated stages from "new" to "engaged" with a Gone Cold view for students who haven't shown up in 30+ days.
4. **Natural-language queries** — ask "who came the last three weeks but not this one" in plain English and get a table back.
5. **Ride coordination** — carpool sessions per event with a solver that respects seat caps and an optional same-gender driver/passenger rule.

It also produces AI-generated insights about what drove attendance, and lets advisors draft outreach messages.

There is more detail in the repo's README. Read it before you start guiding the user, or fetch it on demand.

## What you need to walk them through

Top to bottom. Don't skip steps even if the user says they've done part of it — verify.

### 1. Pre-flight check (ask, don't assume)

- Do you have a GitHub account? (Required.)
- Do you have a payment method handy? Vercel and Anthropic both have free tiers but typically want billing details on file.
- Do you have a Mac/Linux/Windows machine where you can run a few terminal commands, or do you prefer to do everything in the browser?
- Are you the person who will own the deployment long-term, or are you setting this up for someone else?
- Do you understand that you, not the maintainer of Fold, are responsible for your students' data once you deploy this?

### 2. Fork the repo

- Have them visit `https://github.com/andrewyu47/Fold-public` and click **Fork**.
- Confirm the fork lives under their account or their ministry's GitHub org.

### 3. Provision a Turso database

- Walk them through signing up at https://turso.tech (free tier is fine for any single ministry).
- Have them install the Turso CLI (`brew install tursodatabase/tap/turso` on Mac, see Turso docs for other OSs).
- Run: `turso auth signup`, then `turso db create fold`.
- Capture `turso db show fold --url` (this becomes `TURSO_DATABASE_URL`).
- Capture `turso db tokens create fold` (this becomes `TURSO_AUTH_TOKEN`).
- Write both values down somewhere safe — they need them in step 5.

### 4. Get an Anthropic API key

- Sign up at https://console.anthropic.com.
- Create an API key and copy it. Treat it like a credit card.
- This becomes `ANTHROPIC_API_KEY`.
- Remind them: AI features (Smart Intake, Ask, Insights) cost tokens. A small ministry will spend pennies to a few dollars a month. Tell them to set a billing limit.

### 5. Deploy to Vercel

- Have them sign in at https://vercel.com with their GitHub account.
- Click **New Project**, pick their fork. Framework auto-detects as Next.js.
- Before clicking deploy, add environment variables:
  - `ANTHROPIC_API_KEY` from step 4
  - `TURSO_DATABASE_URL` from step 3
  - `TURSO_AUTH_TOKEN` from step 3
  - `AUTH_SECRET` — generate with `openssl rand -hex 32` (give them the command). Tell them never to commit this or share it.
  - `ALLOWED_DOMAIN` — optional but recommended. If their ministry has its own email domain (e.g., `cmu.edu`, `mychurch.org`), set this to lock signups to that domain. If they only use Gmail/personal addresses, leave it blank but plan to delete the seed admin and add users manually instead of leaving signups open.
- Click **Deploy**.

### 6. Run the first-time migration

After the first deploy succeeds, the database schema isn't created yet. They need to run the migration and seed from their local machine. Help them:

```bash
git clone https://github.com/<their-username>/Fold-public.git
cd Fold-public
npm install
TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate.ts
TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/seed.ts
```

The seed creates a default admin user: `admin@example.com` / `password123`. This is intentionally trivial because it's about to be changed.

### 7. Lock down the seed account

This is a security checkpoint. Do not skip.

- Have them visit their live Vercel URL.
- Sign in with the seed credentials.
- **Immediately** sign up a new account with their real email (this is why `ALLOWED_DOMAIN` matters — if it's blank, anyone can sign up).
- Either:
  - Delete the `admin@example.com` user from the database (via `turso db shell fold` → `DELETE FROM users WHERE email = 'admin@example.com';`), or
  - Change its password by updating the `passwordHash` column.

If `ALLOWED_DOMAIN` is blank and they don't want to set it, recommend they enable Vercel's **Deployment Protection** (Vercel Pro feature) or at least delete the seed user before sharing the URL.

### 8. Invite the team

- For each ministry advisor, have them visit `/signup` on the live URL and create their own account with their own email.
- Sessions last 30 days. There is no password-reset email flow built in; if an advisor forgets their password, an admin has to update the hash in the database manually. Tell the user this up front so they aren't surprised.

### 9. (Optional) Custom domain

- In Vercel project settings, add a custom domain.
- Point a CNAME at the provided target from their DNS provider.
- This is purely cosmetic but most ministries want `fold.theirchurch.org` instead of `their-thing.vercel.app`.

### 10. Show them the in-app help

Once they're signed in, point them at `/help` in the app. It explains every page, has a FAQ, and is the right destination for "how does X work" questions later.

## Security expectations to set explicitly

The user is now operating a small piece of infrastructure. Make sure they hear all of this:

- **You are responsible for your students' data.** The maintainer of Fold does not see it, store it, or have any liability for it.
- Strong, unique passwords for every advisor. Recommend a password manager.
- `AUTH_SECRET` and `ANTHROPIC_API_KEY` must never end up in a public repo, screenshot, or Slack message.
- If an advisor leaves the ministry, delete their user row.
- Take a backup of the Turso DB periodically. `turso db shell fold ".dump"` writes the whole thing to a file.
- Anthropic costs scale with usage. Set a billing alert on the Anthropic console.
- If anything leaks, rotate the Anthropic key first, then `AUTH_SECRET` (which logs everyone out).

## Decisions the user has to make — don't decide for them

- Whether to lock `ALLOWED_DOMAIN` to their email domain.
- Whether to use Vercel Deployment Protection in addition to app-level auth.
- Whether to point a custom domain at the deployment.
- Backup cadence (weekly is fine for most small ministries).
- Whether to enable the same-gender carpool rule by default (this is per-session in the app, but they should have an opinion).

## When to stop

You're done when:

- The site is live at a Vercel URL.
- The user has signed in with their real account.
- The seed `admin@example.com` user has been deleted or had its password changed.
- The user knows where `/help` is and where to find the maintainer's feedback page.

## A note on `DEMO_MODE`

There is a `DEMO_MODE=1` env var that exists *only* for running the public demo site at fold-public.vercel.app. When it's on:

- The login wall is bypassed. Every visitor acts as the first user in the database.
- All AI features (Insights, Smart Intake, Ask, Modify, ride parsing, draft outreach) return mocked or canned responses instead of calling Anthropic.

**Do not enable `DEMO_MODE` on a real ministry instance.** It exposes everything to anyone with the URL. If the user asks about it, explain clearly: it is for the maintainer's public showcase, not for their deployment.

## What this isn't

- This is open-source software with no SLA, no support contract, no on-call rotation. If something breaks at 2am during retreat, the user has to fix it.
- The maintainer is happy to take bug reports and pull requests but is not responsible for any individual ministry's deployment.
- Tell the user this kindly but clearly.
