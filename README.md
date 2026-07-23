# Silver Roach — precious metals portfolio tracker

Track the value of your gold, silver, platinum and palladium holdings, see how
each metal has moved over 30 days and 1 year, and watch your **total portfolio
value over time**. Multi-user with Supabase auth — every account has its own stack.

Spot prices come from the **Metal Sentinel** API (sourced from Kitco) via a
server-side proxy, so your API key never reaches the browser.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS**
- **Supabase Auth** (email + password)
- **Postgres + Prisma** (holdings and daily metal price history)
- **Recharts** (value-over-time and composition charts)
- **Vercel Cron** (daily price snapshot job)

## How it fits together

```
Browser ──▶ Next.js (your server)
              ├─ Server Components / Actions ──▶ Prisma ──▶ Postgres (holdings, price history)
              ├─ /api/metals/* ──┐
              └─ /api/cron/snapshot ──┐
                                      └──▶ Metal Sentinel (RapidAPI)   [key stays here]
```

- **Holdings & history** live in Postgres, scoped to the Supabase user id.
- **Spot prices** are fetched server-side; the `RAPIDAPI_KEY` is never shipped to
  the client.
- **Value over time** is built from `MetalPriceSnapshot` rows — one row per
  held metal per day, written by the cron job at current spot. The dashboard
  prices *today's* holdings against that history, so a holding you added and
  later deleted never shows up as a phantom spike: it just has zero weight,
  today and in the past.

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

At https://supabase.com create a project, then from **Project Settings → API**
copy the Project URL and the `anon` public key. From **Project Settings →
Database → Connection string** copy both the **pooled** (port 6543) and
**direct** (port 5432) connection strings.

### 3. Get a Metal Sentinel key

Subscribe (free tier) at https://rapidapi.com/ghostsvos/api/metal-sentinel and
copy your RapidAPI key.

### 3b. Get a Resend key (for price alert emails)

Sign up (free tier) at https://resend.com and copy an API key from
**API Keys**. For local testing you can use the sandbox sender
`onboarding@resend.dev` — it only delivers to the email address on your
Resend account. For production, verify a sending domain and set `RESEND_FROM`
to an address on it.

### 4. Environment

```bash
cp .env.example .env
```

Fill in every value. `RAPIDAPI_KEY` and `CRON_SECRET` must **not** be prefixed
with `NEXT_PUBLIC_`.

### 5. Database schema

```bash
npx prisma migrate dev --name init   # or: npx prisma db push
```

### 6. Run

```bash
npm run dev
```

Open http://localhost:3000, create an account, add a holding.

> If Supabase email confirmation is on, confirm via the emailed link before
> signing in. You can turn confirmation off in **Authentication → Providers →
> Email** while developing.

> **Forgot password** emails a reset link (Supabase's default "Reset Password"
> template using `{{ .ConfirmationURL }}` works as-is — no dashboard changes
> needed). Just make sure `NEXT_PUBLIC_SITE_URL` below matches a Redirect URL
> configured in **Supabase → Authentication → URL Configuration**.

### 7. Seed your first chart point

The value chart needs at least two days of price history. Trigger a snapshot manually:

```bash
curl -H "authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/snapshot
```

Run it again later (or wait for the scheduled job) to see the line grow.

## Deploy (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. Add all `.env` variables in **Project → Settings → Environment Variables**
   (including `CRON_SECRET` — Vercel Cron sends it automatically as a Bearer
   token to the snapshot route). Set `NEXT_PUBLIC_SITE_URL` to your real
   production domain (e.g. `https://yourapp.com`) — it's used to build the
   password-reset email link, and must also be added as a Redirect URL in
   **Supabase → Authentication → URL Configuration**.
3. `vercel.json` already schedules the snapshot daily at 23:00 UTC. Adjust the
   cron expression there if you like.

## ⚠️ One thing to verify before going live

The exact field names *inside* each Metal Sentinel response row weren't published
(responses are wrapped as `{ ID, results: [...] }`, and the docs reference
`symbol=` while the marketing curl uses `metal=`). All of that is isolated in
**`src/lib/metals.ts`**:

- `SYMBOL_PARAM` — flip to `"metal"` if the API rejects `symbol`.
- `PRICE_KEYS` / `TIME_KEYS` — the parser scans these likely field names; once
  you see a real response in the RapidAPI playground, set them to the exact keys.

Nothing else in the app needs to change.

## Notes & next steps

- **Price alerts:** users can set above/below alerts from the Price Alerts tab
  of their profile, either on a metal's raw spot price or on a specific
  holding's current value (weight × purity × quantity × spot, re-read fresh
  each run so holding edits are reflected). A target that's already crossed
  by the current price/value is rejected at creation. `/api/cron/check-alerts`
  checks alerts right after each price refresh (same 90-minute GitHub Actions
  job) and emails via Resend when a threshold is crossed. Alerts are one-shot
  — they deactivate after firing and must be re-enabled to watch again.
- **Quota:** spot responses are cached ~60s per server instance. For production
  traffic across many instances, back the cache with Redis/Upstash.
- **Row-level security:** ownership is enforced in app code (every query filters
  by `userId`). For defence in depth you can also enable Supabase RLS on the
  tables.
- **Currencies:** the API supports 180+ fiats and crypto. Everything here assumes
  USD; add a per-user currency preference and thread it through `getSpots`.
- **Base metals:** copper, nickel, etc. are already in `metals-meta.ts`; note
  Kitco quotes those differently (per lb / per tonne), so add unit handling
  before showing them.
```

This project is a starting scaffold — review the auth, validation, and error
handling against your own requirements before relying on it.
