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
