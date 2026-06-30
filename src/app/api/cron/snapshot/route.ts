import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSpots } from "@/lib/metals";
import { toTroyOz } from "@/lib/units";

// GET /api/cron/snapshot
// Writes a daily portfolio-value snapshot for every user who has holdings.
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

  const holdings = await prisma.holding.findMany();
  if (holdings.length === 0) {
    return NextResponse.json({ ok: true, users: 0, note: "No holdings to snapshot" });
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

  // Sum value per user.
  const valueByUser = new Map<string, number>();
  for (const h of holdings) {
    const spot = spots[h.symbol] ?? 0;
    const value = toTroyOz(h.weight, h.unit) * spot;
    valueByUser.set(h.userId, (valueByUser.get(h.userId) ?? 0) + value);
  }

  await prisma.portfolioSnapshot.createMany({
    data: Array.from(valueByUser.entries()).map(([userId, value]) => ({ userId, value })),
  });

  return NextResponse.json({
    ok: true,
    users: valueByUser.size,
    symbols,
    at: new Date().toISOString(),
  });
}
