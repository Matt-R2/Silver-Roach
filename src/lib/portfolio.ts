// Pure derivation of dashboard view-data (rows, value-over-time history,
// composition) from a set of holdings + cached price data. No Prisma, no
// server-only imports — shared by the real dashboard (server-computed) and
// the demo dashboard (recomputed client-side after every local edit).
import { toTroyOz } from "@/lib/units";

export type HoldingInput = {
  id: string;
  symbol: string;
  weight: number;
  unit: string;
  quantity: number;
  purity: number;
  nickname: string | null;
  note: string | null;
};

export type Row = {
  id: string;
  symbol: string;
  weight: number;
  unit: string;
  quantity: number;
  purity: number;
  nickname: string | null;
  note: string | null;
  ozt: number;
  spot: number;
  value: number;
  chg30Value: number | null;
  chg30Pct: number | null;
  chg1yValue: number | null;
  chg1yPct: number | null;
};

export type SnapshotPoint = { t: string; value: number };
export type CompositionSlice = { symbol: string; value: number };
export type WeightSlice = { symbol: string; ozt: number };

export type PriceData = {
  spots: Record<string, number | null>;
  pointsBySymbol: Record<string, { p30: number | null; p1y: number | null }>;
  // day (YYYY-MM-DD) -> symbol -> price
  pricesByDay: Record<string, Record<string, number>>;
};

export function buildPriceData(
  cachedRows: { symbol: string; priceUsd: number }[],
  pointsRows: { symbol: string; p30Usd: number | null; p1yUsd: number | null }[],
  priceSnapshots: { symbol: string; priceUsd: number; takenAt: Date }[]
): PriceData {
  const spots: Record<string, number | null> = Object.fromEntries(cachedRows.map((c) => [c.symbol, c.priceUsd]));

  const pointsBySymbol: Record<string, { p30: number | null; p1y: number | null }> = Object.fromEntries(
    pointsRows.map((r) => [r.symbol, { p30: r.p30Usd, p1y: r.p1yUsd }])
  );

  const pricesByDay: Record<string, Record<string, number>> = {};
  for (const s of priceSnapshots) {
    const day = s.takenAt.toISOString().slice(0, 10);
    (pricesByDay[day] ??= {})[s.symbol] = s.priceUsd;
  }

  return { spots, pointsBySymbol, pricesByDay };
}

export function computePortfolio(holdings: HoldingInput[], price: PriceData) {
  const spots = price.spots;

  // ozt is the fine (pure) troy-oz content: per-piece weight × piece count × purity.
  // Bullion defaults to purity 1, so this matches the prior weight×quantity behavior.
  const rows: Row[] = holdings.map((h) => {
    const ozt = toTroyOz(h.weight, h.unit) * h.quantity * h.purity;
    const spot = spots[h.symbol] ?? 0;
    const value = ozt * spot;
    const p30 = price.pointsBySymbol[h.symbol]?.p30 ?? null;
    const p1y = price.pointsBySymbol[h.symbol]?.p1y ?? null;
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
  const heldSymbols = Object.keys(weightBySymbol);

  const pricesByDay = new Map(Object.entries(price.pricesByDay));

  // Today's bucket always tracks the live spot cache rather than the once-
  // daily snapshot, so the chart's "today" point updates every time prices
  // refresh instead of waiting for the nightly snapshot job.
  const todayKey = new Date().toISOString().slice(0, 10);
  if (heldSymbols.length > 0 && heldSymbols.every((s) => (spots[s] ?? 0) > 0)) {
    pricesByDay.set(todayKey, Object.fromEntries(heldSymbols.map((s) => [s, spots[s] as number])));
  }

  // Stamp every day at noon UTC, not midnight, so the chart's "today" doesn't
  // silently render as "yesterday" once the client formats it in local time.
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

  return { rows, history, composition, weightComposition };
}
