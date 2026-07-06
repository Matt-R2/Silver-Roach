import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
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

  // Spot + change-point prices are only ever written by /api/cron/refresh-prices
  // (see vercel.json for the schedule). The dashboard never calls the live API
  // itself — every metal is its own upstream API call, so doing that per
  // page-load would blow through the monthly quota.
  const [cachedRows, pointsRows] = await Promise.all([
    prisma.metalSpotCache.findMany(),
    prisma.metalPointsCache.findMany({ where: { symbol: { in: heldSymbols } } }),
  ]);
  const spots: Record<string, number | null> = Object.fromEntries(
    cachedRows.map((c: { symbol: string; priceUsd: number }) => [c.symbol, c.priceUsd])
  );
  const pricesUpdatedAt: string | null = cachedRows.length
    ? cachedRows
        .reduce((a: Date, c: { updatedAt: Date }) => (c.updatedAt > a ? c.updatedAt : a), cachedRows[0].updatedAt)
        .toISOString()
    : null;

  const pointsBySymbol: Record<string, { p30: number | null; p1y: number | null }> = Object.fromEntries(
    pointsRows.map((r: { symbol: string; p30Usd: number | null; p1yUsd: number | null }) => [
      r.symbol,
      { p30: r.p30Usd, p1y: r.p1yUsd },
    ])
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
