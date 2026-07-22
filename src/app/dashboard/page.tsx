import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { buildPriceData, computePortfolio, type HoldingInput } from "@/lib/portfolio";
import DashboardClient from "./dashboard-client";

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
  const pricesUpdatedAt: string | null = cachedRows.length
    ? cachedRows
        .reduce((a: Date, c: { updatedAt: Date }) => (c.updatedAt > a ? c.updatedAt : a), cachedRows[0].updatedAt)
        .toISOString()
    : null;

  const priceData = buildPriceData(cachedRows, pointsRows, priceSnapshots);
  const holdingInputs: HoldingInput[] = holdings.map((h) => ({
    id: h.id,
    symbol: h.symbol,
    weight: h.weight,
    unit: h.unit,
    quantity: h.quantity,
    purity: h.purity,
    nickname: h.nickname,
    note: h.note,
  }));
  const { rows, history, composition, weightComposition } = computePortfolio(holdingInputs, priceData);

  const ticker = ["AU", "AG", "PT", "PD"].map((s) => ({ symbol: s, spot: priceData.spots[s] ?? null }));

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
