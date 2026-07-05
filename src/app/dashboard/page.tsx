import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getSpots, getPoints } from "@/lib/metals";
import { toTroyOz } from "@/lib/units";
import DashboardClient, { type Row, type SnapshotPoint } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [holdings, snapshots] = await Promise.all([
    prisma.holding.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.portfolioSnapshot.findMany({
      where: { userId: user.id },
      orderBy: { takenAt: "asc" },
      take: 365,
    }),
  ]);

  const heldSymbols = Array.from(new Set(holdings.map((h) => h.symbol)));

  // Read spot prices from the DB cache (written hourly by /api/cron/refresh-prices).
  // Falls back to a live API call when the cache is empty or stale (>90 min old),
  // which covers local dev where the Vercel Cron never fires.
  const STALE_MS = 90 * 60 * 1000;
  const cachedRows = await prisma.metalSpotCache.findMany();
  const spots: Record<string, number | null> = Object.fromEntries(
    cachedRows.map((c: { symbol: string; priceUsd: number }) => [c.symbol, c.priceUsd])
  );
  const isStale =
    cachedRows.length === 0 ||
    cachedRows.some((c: { updatedAt: Date }) => Date.now() - c.updatedAt.getTime() > STALE_MS);
  let pricesUpdatedAt: string;
  if (isStale) {
    const refreshSymbols = Array.from(new Set([...heldSymbols, "AU", "AG", "PT", "PD"]));
    const liveSpots = await getSpots(refreshSymbols);
    Object.assign(spots, liveSpots);
    await Promise.all(
      Object.entries(liveSpots).map(async ([symbol, priceUsd]) => {
        if (priceUsd == null) return;
        await prisma.metalSpotCache.upsert({
          where: { symbol },
          update: { priceUsd },
          create: { symbol, priceUsd },
        });
      })
    );
    pricesUpdatedAt = new Date().toISOString();
  } else {
    const newest = cachedRows.reduce(
      (a: Date, c: { updatedAt: Date }) => (c.updatedAt > a ? c.updatedAt : a),
      cachedRows[0].updatedAt
    );
    pricesUpdatedAt = newest.toISOString();
  }

  // 30d / 1y change points, only for held metals (skips quota when empty).
  const pointsBySymbol: Record<string, { p30: number | null; p1y: number | null }> = {};
  await Promise.all(
    heldSymbols.map(async (s: string) => {
      try {
        const pts = await getPoints(s);
        pointsBySymbol[s] = {
          p30: pts.find((p) => p.period === "30d")?.price ?? null,
          p1y: pts.find((p) => p.period === "1y")?.price ?? null,
        };
      } catch {
        pointsBySymbol[s] = { p30: null, p1y: null };
      }
    })
  );

  const rows: Row[] = holdings.map((h) => {
    const ozt = toTroyOz(h.weight, h.unit);
    const spot = spots[h.symbol] ?? 0;
    const value = ozt * spot;
    const p30 = pointsBySymbol[h.symbol]?.p30 ?? null;
    const p1y = pointsBySymbol[h.symbol]?.p1y ?? null;
    return {
      id: h.id,
      symbol: h.symbol,
      weight: h.weight,
      unit: h.unit,
      paid: h.paid,
      ozt,
      spot,
      value,
      chg30Value: p30 != null ? ozt * (spot - p30) : null,
      chg30Pct: p30 ? (spot - p30) / p30 : null,
      chg1yValue: p1y != null ? ozt * (spot - p1y) : null,
      chg1yPct: p1y ? (spot - p1y) / p1y : null,
      gain: h.paid != null ? value - h.paid : null,
      gainPct: h.paid ? (value - h.paid) / h.paid : null,
    };
  });

  const history: SnapshotPoint[] = snapshots.map((s) => ({
    t: s.takenAt.toISOString(),
    value: s.value,
  }));

  const ticker = ["AU", "AG", "PT", "PD"].map((s) => ({ symbol: s, spot: spots[s] ?? null }));

  return (
    <DashboardClient
      email={user.email ?? ""}
      rows={rows}
      history={history}
      ticker={ticker}
      pricesUpdatedAt={pricesUpdatedAt}
    />
  );
}
