import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSpots, getPoints } from "@/lib/metals";
import { ALL_SYMBOLS } from "@/lib/metals-meta";

// GET /api/cron/refresh-prices
// The ONLY place that calls the live Metal Sentinel API. Every metal is its own
// API call upstream (no bulk endpoint), so this runs on a fixed 90-minute
// schedule (see .github/workflows/refresh-prices.yml) rather than per page-load,
// to stay well under the monthly quota. Fetches spot + 30d/1y change prices for
// all 10 metals and upserts them into MetalSpotCache / MetalPointsCache.
// Dashboard and snapshot routes only ever read these caches.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  const fromQuery = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? fromQuery;

  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbols = [...ALL_SYMBOLS];

  const spots = await getSpots(symbols);
  const results = { updatedSpot: [] as string[], failedSpot: [] as string[], updatedPoints: [] as string[] };

  await Promise.all(
    symbols.map(async (symbol) => {
      const priceUsd = spots[symbol];
      if (priceUsd == null) {
        results.failedSpot.push(symbol);
        return;
      }
      await prisma.metalSpotCache.upsert({
        where: { symbol },
        update: { priceUsd },
        create: { symbol, priceUsd },
      });
      results.updatedSpot.push(symbol);
    })
  );

  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const pts = await getPoints(symbol);
        const p30Usd = pts.find((p) => p.period === "30d")?.price ?? null;
        const p1yUsd = pts.find((p) => p.period === "1y")?.price ?? null;
        await prisma.metalPointsCache.upsert({
          where: { symbol },
          update: { p30Usd, p1yUsd },
          create: { symbol, p30Usd, p1yUsd },
        });
        results.updatedPoints.push(symbol);
      } catch {
        // Leave the previously cached value in place rather than failing the run.
      }
    })
  );

  return NextResponse.json({ ok: true, symbols, ...results, at: new Date().toISOString() });
}
