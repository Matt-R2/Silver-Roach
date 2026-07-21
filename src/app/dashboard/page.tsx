import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { toTroyOz } from "@/lib/units";
import DashboardClient, { type Row, type SnapshotPoint, type CompositionSlice, type WeightSlice } from "./dashboard-client";

export const dynamic = "force-dynamic";

const HISTORY_LOOKBACK_DAYS = 400;

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [holdings, profile] = await Promise.all([
    prisma.holding.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.profile.findUnique({ where: { userId: user.id }, select: { displayName: true } }),
  ]);

  const heldSymbols = Array.from(new Set(holdings.map((h) => h.symbol)));

  // Spot + change-point prices are only ever written by /api/cron/refresh-prices
  // (see vercel.json for the schedule). The dashboard never calls the live API
  // itself — every metal is its own upstream API call, so doing that per
  // page-load would blow through the monthly quota.
  const [cachedRows, pointsRows, priceSnapshots] = await Promise.all([
    prisma.metalSpotCache.findMany(),
    prisma.metalPointsCache.findMany({ where: { symbol: { in: heldSymbols } } }),
    prisma.metalPriceSnapshot.findMany({
      where: {
        symbol: { in: heldSymbols },
        takenAt: { gte: new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
      },
      orderBy: { takenAt: "asc" },
    }),
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
    // ozt is the fine (pure) troy-oz content: per-piece weight × piece count × purity.
    // Bullion defaults to purity 1, so this matches the prior weight×quantity behavior.
    const ozt = toTroyOz(h.weight, h.unit) * h.quantity * h.purity;
    const spot = spots[h.symbol] ?? 0;
    const value = ozt * spot;
    const p30 = pointsBySymbol[h.symbol]?.p30 ?? null;
    const p1y = pointsBySymbol[h.symbol]?.p1y ?? null;
    return {
      id: h.id,
      symbol: h.symbol,
      weight: h.weight,
      unit: h.unit,
      quantity: h.quantity,
      purity: h.purity,
      nickname: h.nickname,
      note: h.note,
      ozt,
      spot,
      value,
      chg30Value: p30 != null ? ozt * (spot - p30) : null,
      chg30Pct: p30 ? (spot - p30) / p30 : null,
      chg1yValue: p1y != null ? ozt * (spot - p1y) : null,
      chg1yPct: p1y ? (spot - p1y) / p1y : null,
    };
  });

  // Chart is a fixed-weight price index: today's fine-oz holdings per symbol,
  // priced at each historical day. A holding added and later deleted has zero
  // weight today, so it never appears in the history — no phantom spike.
  const weightBySymbol: Record<string, number> = {};
  for (const r of rows) {
    weightBySymbol[r.symbol] = (weightBySymbol[r.symbol] ?? 0) + r.ozt;
  }

  const pricesByDay = new Map<string, Record<string, number>>();
  for (const s of priceSnapshots) {
    const day = s.takenAt.toISOString().slice(0, 10);
    const bucket = pricesByDay.get(day) ?? {};
    bucket[s.symbol] = s.priceUsd;
    pricesByDay.set(day, bucket);
  }

  // Today's bucket always tracks the live spot cache rather than the once-
  // daily snapshot, so the chart's "today" point updates every time
  // /api/cron/refresh-prices refreshes prices (~every 90 min) instead of
  // waiting for the nightly snapshot job. This still yields one point per
  // day, never hour-by-hour.
  const todayKey = new Date().toISOString().slice(0, 10);
  if (heldSymbols.length > 0 && heldSymbols.every((s) => (spots[s] ?? 0) > 0)) {
    pricesByDay.set(todayKey, Object.fromEntries(heldSymbols.map((s) => [s, spots[s] as number])));
  }

  // Stamp every day at noon UTC, not midnight. Midnight UTC lands in the
  // previous local calendar day for the whole western hemisphere once the
  // client formats it in local time (e.g. toLocaleDateString), which made
  // "today" silently render as "yesterday" for most of the day. Noon UTC
  // stays on the correct calendar date for any real-world timezone.
  const history: SnapshotPoint[] = Array.from(pricesByDay.entries())
    .filter(([, prices]) => heldSymbols.length > 0 && heldSymbols.every((s) => prices[s] != null))
    .map(([day, prices]) => ({
      t: new Date(`${day}T12:00:00.000Z`).toISOString(),
      value: heldSymbols.reduce((sum, s) => sum + weightBySymbol[s] * prices[s], 0),
    }))
    .sort((a, b) => a.t.localeCompare(b.t));

  const compositionMap = new Map<string, number>();
  for (const r of rows) {
    compositionMap.set(r.symbol, (compositionMap.get(r.symbol) ?? 0) + r.value);
  }
  const composition: CompositionSlice[] = Array.from(compositionMap.entries())
    .filter(([, value]) => value > 0)
    .map(([symbol, value]) => ({ symbol, value }))
    .sort((a, b) => b.value - a.value);

  const weightComposition: WeightSlice[] = Object.entries(weightBySymbol)
    .filter(([, ozt]) => ozt > 0)
    .map(([symbol, ozt]) => ({ symbol, ozt }))
    .sort((a, b) => b.ozt - a.ozt);

  const ticker = ["AU", "AG", "PT", "PD"].map((s) => ({ symbol: s, spot: spots[s] ?? null }));

  return (
    <DashboardClient
      email={user.email ?? ""}
      displayName={profile?.displayName ?? ""}
      rows={rows}
      history={history}
      composition={composition}
      weightComposition={weightComposition}
      ticker={ticker}
      pricesUpdatedAt={pricesUpdatedAt}
    />
  );
}
