import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSpots } from "@/lib/metals";

// GET /api/cron/snapshot
// Writes one daily price row per held metal symbol (not per user/portfolio).
// Dashboards recompute each user's history from these prices against their
// *current* holdings, so a holding someone added and later deleted never
// shows up as a phantom spike in anyone's chart.
// Protected by CRON_SECRET. Vercel Cron sends it automatically as a Bearer token;
// you can also call it manually:  curl -H "authorization: Bearer $CRON_SECRET" .../api/cron/snapshot
export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : null;
  const fromQuery = new URL(request.url).searchParams.get("secret");
  const provided = bearer ?? fromQuery;

  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holdings = await prisma.holding.findMany({ select: { symbol: true } });
  if (holdings.length === 0) {
    return NextResponse.json({ ok: true, symbols: 0, note: "No holdings to snapshot" });
  }

  const symbols = Array.from(new Set(holdings.map((h) => h.symbol)));

  // Prefer DB cache; fall back to live API only for symbols not yet cached.
  const cached = await prisma.metalSpotCache.findMany({ where: { symbol: { in: symbols } } });
  const spots: Record<string, number | null> = Object.fromEntries(
    cached.map((c: { symbol: string; priceUsd: number }) => [c.symbol, c.priceUsd])
  );
  const missing = symbols.filter((s) => spots[s] == null);
  if (missing.length > 0) {
    const live = await getSpots(missing);
    Object.assign(spots, live);
  }

  const rows = symbols
    .filter((s) => spots[s] != null)
    .map((symbol) => ({ symbol, priceUsd: spots[symbol] as number }));

  await prisma.metalPriceSnapshot.createMany({ data: rows });

  return NextResponse.json({
    ok: true,
    symbols: rows.map((r) => r.symbol),
    at: new Date().toISOString(),
  });
}
