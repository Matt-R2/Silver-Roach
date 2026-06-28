// SERVER-ONLY. Uses RAPIDAPI_KEY — never import this into a client component.
//
// This is the single place where Metal Sentinel response shapes are parsed.
// The docs show responses wrapped as { ID, results: [ ... ] }, but the exact
// price/timestamp field names inside each result row were not published. The
// parsing below is defensive (it scans a list of likely keys). Open the RapidAPI
// playground once, look at a real response, and tighten PRICE_KEYS / TIME_KEYS
// to the real field names — everything else in the app can stay unchanged.

const BASE = "https://metal-sentinel.p.rapidapi.com";
const HOST = "metal-sentinel.p.rapidapi.com";

// The endpoints reference uses `symbol=`; the marketing curl uses `metal=`.
// Verify in the playground and set whichever the live API accepts.
const SYMBOL_PARAM = "symbol";

const PRICE_KEYS = ["price", "spot", "rate", "value", "ask", "close", "last", "mid"];
const TIME_KEYS = ["timestamp", "time", "date", "t"];

function headers(): HeadersInit {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is not set in the environment");
  return { "x-rapidapi-key": key, "x-rapidapi-host": HOST };
}

// Simple per-instance TTL cache. Good enough to protect free-tier quota for a
// single serverless instance; for multi-instance production use Redis/Upstash.
const cache = new Map<string, { value: unknown; expires: number }>();

async function fetchJson(url: string, ttlMs: number): Promise<any> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.value;

  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Metal Sentinel ${res.status} for ${url}`);
  }
  const value = await res.json();
  cache.set(url, { value, expires: Date.now() + ttlMs });
  return value;
}

function pickNumber(obj: any, keys: string[]): number | null {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = parseFloat(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function firstRow(data: any): any {
  if (Array.isArray(data?.results)) return data.results[0] ?? null;
  if (Array.isArray(data)) return data[0] ?? null;
  return data;
}

export type Spot = { symbol: string; currency: string; price: number | null };

export async function getSpot(symbol: string, currency = "USD"): Promise<Spot> {
  const url = `${BASE}/api/metal-quote?${SYMBOL_PARAM}=${symbol}&currency=${currency}`;
  const data = await fetchJson(url, 60_000); // 60s cache
  return { symbol, currency, price: pickNumber(firstRow(data), PRICE_KEYS) };
}

export async function getSpots(
  symbols: string[],
  currency = "USD"
): Promise<Record<string, number | null>> {
  const out: Record<string, number | null> = {};
  await Promise.all(
    symbols.map(async (s) => {
      try {
        out[s] = (await getSpot(s, currency)).price;
      } catch {
        out[s] = null;
      }
    })
  );
  return out;
}

export type Point = { period: "30d" | "60d" | "1y" | "5y"; price: number | null };

// /api/historical-points returns snapshots at 30d, 60d, 1y and 5y before `timestamp`.
// Shape of the result rows is unconfirmed; this maps defensively and returns
// nulls for anything it can't find so the UI degrades gracefully.
export async function getPoints(symbol: string, currency = "USD"): Promise<Point[]> {
  const ts = Math.floor(Date.now() / 1000);
  const url = `${BASE}/api/historical-points?${SYMBOL_PARAM}=${symbol}&currency=${currency}&timestamp=${ts}`;
  const data = await fetchJson(url, 6 * 60 * 60 * 1000); // 6h cache
  const rows: any[] = Array.isArray(data?.results) ? data.results : [];

  // Try to match each known period to a row by a label-ish field, else fall back
  // to positional order [30d, 60d, 1y, 5y].
  const order: Point["period"][] = ["30d", "60d", "1y", "5y"];
  const labelKeys = ["period", "label", "range", "window"];
  const labelOf = (r: any) => {
    for (const k of labelKeys) if (typeof r?.[k] === "string") return String(r[k]).toLowerCase();
    return "";
  };
  return order.map((period, i) => {
    const byLabel = rows.find((r) => labelOf(r).includes(period.replace("y", "")) && labelOf(r).includes(period.includes("y") ? "y" : "d"));
    const row = byLabel ?? rows[i] ?? null;
    return { period, price: pickNumber(row, PRICE_KEYS) };
  });
}

export type Candle = { t: number; price: number };

export async function getHistory(
  symbol: string,
  currency: string,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  const url = `${BASE}/api/metal-history?${SYMBOL_PARAM}=${symbol}&currency=${currency}&startTime=${startTime}&endTime=${endTime}&limit=30`;
  const data = await fetchJson(url, 60 * 60 * 1000); // 1h cache
  const rows: any[] = Array.isArray(data?.results) ? data.results : [];
  return rows
    .map((r) => ({ t: pickNumber(r, TIME_KEYS) ?? 0, price: pickNumber(r, PRICE_KEYS) }))
    .filter((c): c is Candle => c.price != null)
    .sort((a, b) => a.t - b.t);
}
