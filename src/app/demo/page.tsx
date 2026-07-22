import { prisma } from "@/lib/prisma";
import { ALL_SYMBOLS } from "@/lib/metals-meta";
import { buildPriceData } from "@/lib/portfolio";
import { DEMO_HOLDINGS } from "@/lib/demo-data";
import DemoClient from "./demo-client";

export const dynamic = "force-dynamic";

const HISTORY_LOOKBACK_DAYS = 400;

// Public, unauthenticated preview of the dashboard. Seeded with a sample
// portfolio priced against the same live spot cache the real dashboard
// uses — but every edit here only touches local React state, never Prisma.
export default async function DemoPage() {
  const [cachedRows, pointsRows, priceSnapshots] = await Promise.all([
    prisma.metalSpotCache.findMany(),
    prisma.metalPointsCache.findMany({ where: { symbol: { in: ALL_SYMBOLS } } }),
    prisma.metalPriceSnapshot.findMany({
      where: {
        symbol: { in: ALL_SYMBOLS },
        takenAt: { gte: new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) },
      },
      orderBy: { takenAt: "asc" },
    }),
  ]);

  const pricesUpdatedAt: string | null = cachedRows.length
    ? cachedRows.reduce((a, c) => (c.updatedAt > a ? c.updatedAt : a), cachedRows[0].updatedAt).toISOString()
    : null;

  const priceData = buildPriceData(cachedRows, pointsRows, priceSnapshots);
  const ticker = ["AU", "AG", "PT", "PD"].map((s) => ({ symbol: s, spot: priceData.spots[s] ?? null }));

  return (
    <DemoClient
      initialHoldings={DEMO_HOLDINGS}
      priceData={priceData}
      ticker={ticker}
      pricesUpdatedAt={pricesUpdatedAt}
    />
  );
}
