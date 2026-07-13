// Weight conversions and display formatters. Safe for client and server.

export const TROY_OZ_IN_GRAMS = 31.1034768;

export const UNIT_TO_OZT: Record<string, number> = {
  ozt: 1,
  g: 1 / TROY_OZ_IN_GRAMS,
  kg: 1000 / TROY_OZ_IN_GRAMS,
};

export const UNIT_LABEL: Record<string, string> = {
  ozt: "troy oz",
  g: "grams",
  kg: "kilograms",
};

export function toTroyOz(weight: number, unit: string): number {
  return weight * (UNIT_TO_OZT[unit] ?? 1);
}

export function usd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function num(n: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(n) ? n : 0);
}

export function pct(fraction: number): string {
  const v = Number.isFinite(fraction) ? fraction * 100 : 0;
  return `${v >= 0 ? "+" : ""}${num(v, 2)}%`;
}

// Purity: fraction (0-1] of a holding's weight that is fine metal. Bullion
// coins/bars are effectively pure (defaults to 1); jewelry and older coinage
// are commonly alloyed and need a purity below 1 for an accurate value.
//
// Gold purity is conventionally expressed in karats (parts pure per 24);
// other metals use millesimal fineness (parts pure per 1000). Both reduce to
// the same underlying `purity` fraction stored on the holding.
export type PurityOption = { value: number; label: string };

const GOLD_KARATS = [24, 22, 21, 20, 18, 14, 12, 10, 9];
export const GOLD_PURITY_OPTIONS: PurityOption[] = GOLD_KARATS.map((k) => {
  const value = Math.round((k / 24) * 1000) / 1000;
  return { value, label: k === 24 ? "24k · fine" : `${k}k (.${Math.round(value * 1000)})` };
});

const FINENESS_PER_MILLE = [999, 958, 950, 925, 916, 900, 800, 750];
export const FINENESS_PURITY_OPTIONS: PurityOption[] = FINENESS_PER_MILLE.map((f) => ({
  value: f / 1000,
  label: f === 999 ? ".999 · fine" : `.${f}${f === 925 ? " (sterling)" : f === 900 ? " (coin silver)" : ""}`,
}));

export function purityOptionsFor(symbol: string): PurityOption[] {
  return symbol === "AU" ? GOLD_PURITY_OPTIONS : FINENESS_PURITY_OPTIONS;
}

export function formatPurity(symbol: string, purity: number): string {
  if (!Number.isFinite(purity) || purity >= 0.999) return symbol === "AU" ? "24k" : "fine";
  if (symbol === "AU") return `${Math.round(purity * 24)}k`;
  return `.${Math.round(purity * 1000)}`;
}
