# Assay — precious metals portfolio tracker

Track the value of your gold, silver, platinum and palladium holdings, see how
each metal has moved over 30 days and 1 year, and watch your **total portfolio
value over time**. Multi-user with Supabase auth — every account has its own stack.

Spot prices come from the **Metal Sentinel** API (sourced from Kitco) via a
server-side proxy, so your API key never reaches the browser.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS**
- **Supabase Auth** (email + password)
- **Postgres + Prisma** (holdings and daily value snapshots)
- **Recharts** (portfolio-value chart)
- **Vercel Cron** (daily snapshot job)

## How it fits together

```
Browser ──▶ Next.js (your server)
              ├─ Server Components / Actions ──▶ Prisma ──▶ Postgres (holdings, snapshots)
              ├─ /api/metals/* ──┐
              └─ /api/cron/snapshot ──┐
                                      └──▶ Metal Sentinel (RapidAPI)   [key stays here]
```

- **Holdings & history** live in Postgres, scoped to the Supabase user id.
- **Spot prices** are fetched server-side; the `RAPIDAPI_KEY` is never shipped to
  the client.
- **Portfolio over time** is built from `PortfolioSnapshot` rows. The cron job
  writes one row per user per day at current spot — the API gives metal prices,
  not what *your* stack was worth last week, so we record it ourselves.

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

### 7. Seed your first chart point

The portfolio chart needs at least two snapshots. Trigger one manually:

```bash
curl -H "authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/snapshot
```

Run it again later (or wait for the scheduled job) to see the line grow.

## Deploy (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. Add all `.env` variables in **Project → Settings → Environment Variables**
   (including `CRON_SECRET` — Vercel Cron sends it automatically as a Bearer
   token to the snapshot route).
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
