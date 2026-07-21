import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getHistory } from "@/lib/metals";
import { ALL_SYMBOLS } from "@/lib/metals-meta";

// GET /api/cron/backfill-history
// One-off (not scheduled): fills MetalPriceSnapshot with real daily history from
// the /metal-history endpoint, so the 1Y chart doesn't have to zero-fill months
// that predate the once-daily snapshot cron. Not wired into any schedule —
// trigger manually, e.g.:
//   curl -H "authorization: Bearer $CRON_SECRET" ".../api/cron/backfill-history?days=30"
//
// getHistory()/`/metal-history` has never been exercised against the live API —
// see the parsing comment at the top of src/lib/metals.ts. Run with a small
// `days` value first and check `candlesSeen` in the response before trusting a
// full 365-day run: 0 candles across every window means TIME_KEYS/PRICE_KEYS or
// the startTime/endTime units (assumed to be Unix seconds here) need fixing.
//
// `/metal-history` caps each response at `limit=30` candles, so full coverage
// requires paging through 30-day windows — up to 13 requests per symbol for a
// year. That's up to 130 sequential upstream calls across all 10 metals, which
// can be slow. Use `symbols=AU,AG` to backfill a few metals per invocation
// and stay well under any serverless execution time limit.
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

function dayKeyUTC(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  const url = new URL(request.url);
  const provided = bearer ?? url.searchParams.get("secret");

  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Number(url.searchParams.get("days") ?? 365);
  const symbolsParam = url.searchParams.get("symbols");
  const symbols = symbolsParam
    ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()).filter((s) => (ALL_SYMBOLS as string[]).includes(s))
    : [...ALL_SYMBOLS];

  const now = Date.now();
  const rangeStart = now - days * MS_PER_DAY;

  const results: Record<
    string,
    { inserted: number; skippedExisting: number; candlesSeen: number; failedWindows: number }
  > = {};

  for (const symbol of symbols) {
    let inserted = 0;
    let candlesSeen = 0;
    let failedWindows = 0;

    // Days this symbol already has in range, so re-running (or overlapping
    // with the once-daily snapshot cron) never creates duplicate rows.
    const existing = await prisma.metalPriceSnapshot.findMany({
      where: { symbol, takenAt: { gte: new Date(rangeStart) } },
      select: { takenAt: true },
    });
    const existingDays = new Set(existing.map((e) => e.takenAt.toISOString().slice(0, 10)));

    for (let windowStart = rangeStart; windowStart < now; windowStart += WINDOW_DAYS * MS_PER_DAY) {
      const windowEnd = Math.min(windowStart + WINDOW_DAYS * MS_PER_DAY, now);
      try {
        const candles = await getHistory(
          symbol,
          "USD",
          Math.floor(windowStart / 1000),
          Math.floor(windowEnd / 1000)
        );
        candlesSeen += candles.length;

        // One row per day: keep the last candle seen for each day (getHistory
        // returns candles sorted ascending by time).
        const byDay = new Map<string, number>();
        for (const c of candles) {
          const ms = c.t > 1e12 ? c.t : c.t * 1000; // tolerate seconds- or ms-based timestamps
          byDay.set(dayKeyUTC(ms), c.price);
        }

        const rows = Array.from(byDay.entries())
          .filter(([day]) => !existingDays.has(day))
          .map(([day, price]) => {
            existingDays.add(day);
            // Noon UTC, matching the dashboard's day-stamping convention —
            // see the comment in src/app/dashboard/page.tsx.
            return { symbol, priceUsd: price, takenAt: new Date(`${day}T12:00:00.000Z`) };
          });

        if (rows.length > 0) {
          await prisma.metalPriceSnapshot.createMany({ data: rows });
          inserted += rows.length;
        }
      } catch {
        failedWindows += 1;
      }
    }

    results[symbol] = {
      inserted,
      skippedExisting: existingDays.size - inserted,
      candlesSeen,
      failedWindows,
    };
  }

  return NextResponse.json({ ok: true, days, symbols, results, at: new Date().toISOString() });
}
