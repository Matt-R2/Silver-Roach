"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { METALS } from "@/lib/metals-meta";
import { usd, num } from "@/lib/units";
import { readHoldingFields } from "@/lib/holding-fields";
import { computePortfolio, type HoldingInput, type PriceData } from "@/lib/portfolio";
import { Chip, Delta, CompositionCard, HoldingCard, AddForm } from "../dashboard/holdings-ui";

type Timeframe = "7d" | "1m" | "1y";

function dayKeyUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDaysUTC(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return dayKeyUTC(d);
}

type Ticker = { symbol: string; spot: number | null };

let demoIdCounter = 0;
function nextDemoId() {
  demoIdCounter += 1;
  return `demo-new-${demoIdCounter}`;
}

export default function DemoClient({
  initialHoldings,
  priceData,
  ticker,
  pricesUpdatedAt,
}: {
  initialHoldings: HoldingInput[];
  priceData: PriceData;
  ticker: Ticker[];
  pricesUpdatedAt: string | null;
}) {
  const [holdings, setHoldings] = useState<HoldingInput[]>(initialHoldings);
  const [adding, setAdding] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");

  // Nothing here ever touches Prisma — every mutation just rewrites local
  // state, so the whole portfolio is recomputed the same way the server
  // does for the real dashboard (see src/lib/portfolio.ts), both on the
  // initial server render and after every local edit.
  const {
    rows: displayRows,
    history: displayHistory,
    composition: displayComposition,
    weightComposition: displayWeightComposition,
  } = useMemo(() => computePortfolio(holdings, priceData), [holdings, priceData]);

  const onAdd = (fd: FormData) => {
    try {
      const fields = readHoldingFields(fd);
      setHoldings((h) => [...h, { id: nextDemoId(), nickname: null, ...fields }]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't add that holding");
    }
  };
  const onUpdate = (fd: FormData) => {
    try {
      const id = String(fd.get("id") || "");
      const fields = readHoldingFields(fd);
      setHoldings((h) => h.map((x) => (x.id === id ? { ...x, ...fields } : x)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't save that holding");
    }
  };
  const onDelete = (fd: FormData) => {
    const id = String(fd.get("id") || "");
    setHoldings((h) => h.filter((x) => x.id !== id));
  };
  const onRename = (fd: FormData) => {
    const id = String(fd.get("id") || "");
    const raw = String(fd.get("nickname") || "").trim();
    const nickname = raw ? raw.slice(0, 40) : null;
    setHoldings((h) => h.map((x) => (x.id === id ? { ...x, nickname } : x)));
  };

  const [updatedAtLabel, setUpdatedAtLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!pricesUpdatedAt) return;
    const d = new Date(pricesUpdatedAt);
    setUpdatedAtLabel(
      `${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`
    );
  }, [pricesUpdatedAt]);

  const totals = useMemo(() => {
    const value = displayRows.reduce((a, r) => a + r.value, 0);
    const chg30 = displayRows.reduce((a, r) => a + (r.chg30Value ?? 0), 0);
    return {
      value,
      chg30,
      chg30Pct: value - chg30 ? chg30 / (value - chg30) : 0,
    };
  }, [displayRows]);

  const chartData = useMemo(() => {
    const byDay = new Map(displayHistory.map((p) => [p.t.slice(0, 10), p.value]));
    const referenceDay = displayHistory.length ? displayHistory[displayHistory.length - 1].t.slice(0, 10) : dayKeyUTC(new Date());

    if (timeframe === "1y") {
      const [refY, refM] = referenceDay.split("-").map(Number);
      const out: { date: string; full: string; value: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(refY, refM - 1 - i, 1));
        const prefix = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        let latestDayInMonth: string | null = null;
        for (const day of byDay.keys()) {
          if (day.startsWith(prefix) && (!latestDayInMonth || day > latestDayInMonth)) latestDayInMonth = day;
        }
        const value = latestDayInMonth ? (byDay.get(latestDayInMonth) as number) : 0;
        const label = `${d.toLocaleDateString("en-US", { month: "short" })} '${String(d.getUTCFullYear()).slice(2)}`;
        out.push({ date: label, full: label, value });
      }
      return out;
    }

    const days = timeframe === "7d" ? 7 : 30;
    const out: { date: string; full: string; value: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = addDaysUTC(referenceDay, -i);
      const d = new Date(`${day}T12:00:00.000Z`);
      out.push({
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        full: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        value: byDay.get(day) ?? 0,
      });
    }
    return out;
  }, [displayHistory, timeframe]);

  const yTicks = useMemo(() => {
    const max = chartData.reduce((m, d) => Math.max(m, d.value), 0);
    if (max <= 0) return [0, 1];
    const roughStep = max / 4;
    const exponent = Math.floor(Math.log10(roughStep));
    const fraction = roughStep / 10 ** exponent;
    const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
    const step = niceFraction * 10 ** exponent;
    const niceMax = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let v = 0; v <= niceMax + step / 2; v += step) ticks.push(Math.round(v));
    return ticks;
  }, [chartData]);

  const formatAxisDollar = (v: number) => {
    if (v === 0) return "$0";
    if (v >= 1000) return `$${v % 1000 === 0 ? v / 1000 : num(v / 1000, 1)}k`;
    return `$${v}`;
  };

  return (
    <main className="mx-auto max-w-5xl px-5 sm:px-8 py-7 pb-16">
      <style>{`
        .ms-input {
          font-family: var(--font-mono); font-size: 14px; color: var(--color-ink);
          background: var(--color-bg); border: 1px solid var(--color-line); border-radius: 8px;
          padding: 9px 11px; min-width: 120px;
        }
        .ms-input:focus { border-color: #4FB286; outline: none; }

        .ms-pill-input {
          font-family: var(--font-sans, inherit); font-size: 13.5px; color: var(--color-pill-text);
          background: var(--color-pill-bg); border: 1.5px solid var(--color-pill-border); border-radius: 9999px;
          padding: 9px 18px; min-width: 160px; text-align: center;
          height: 40px; box-sizing: border-box;
          transition: height 0.15s ease, border-radius 0.15s ease;
        }
        .ms-pill-input::placeholder { color: var(--color-pill-placeholder); }
        .ms-pill-input:focus {
          border-color: #4FB286; outline: none;
          box-shadow: 0 0 0 3px rgba(79, 178, 134, 0.28);
        }
        textarea.ms-pill-input {
          resize: none; line-height: 1.4; overflow-y: hidden;
        }
        textarea.ms-pill-input:focus {
          height: 92px; border-radius: 18px; overflow-y: auto;
        }
        textarea.ms-pill-input {
          scrollbar-width: thin; scrollbar-color: var(--color-pill-border) transparent;
        }
        textarea.ms-pill-input::-webkit-scrollbar { width: 6px; }
        textarea.ms-pill-input::-webkit-scrollbar-track { background: transparent; }
        textarea.ms-pill-input::-webkit-scrollbar-thumb { background: var(--color-pill-border); border-radius: 999px; }
        textarea.ms-pill-input::-webkit-scrollbar-thumb:hover { background: #4FB286; }
      `}</style>

      {/* Demo banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-raised px-5 py-3.5 mb-6">
        <p className="text-sm text-muted">
          You&apos;re trying the live demo — nothing you do here is saved, and it resets when you leave.
        </p>
        <Link
          href="/login?mode=signup"
          className="whitespace-nowrap rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg hover:opacity-90"
        >
          Create free account
        </Link>
      </div>

      <header className="flex items-baseline justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-baseline gap-4 flex-wrap">
          <div className="font-display text-2xl font-bold tracking-[0.14em]">
            SILVERROACH<span className="text-up">.</span>
          </div>
          <span className="text-sm text-muted">Demo</span>
        </div>
        <div className="flex items-center gap-4">
          <span
            aria-disabled="true"
            title="Not available in the demo"
            className="text-dim opacity-40 cursor-not-allowed"
          >
            <Settings size={16} />
          </span>
          <Link href="/" className="text-sm text-muted hover:text-ink">
            Exit demo
          </Link>
        </div>
      </header>

      {/* Spot ticker */}
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 mb-1 scroll-x">
        {ticker.map((t) => {
          const m = METALS[t.symbol];
          return (
            <div
              key={t.symbol}
              className="flex items-center gap-2 flex-none rounded-[10px] border border-hair bg-panel px-3 py-2"
            >
              <Chip symbol={t.symbol} />
              <span className="text-xs text-muted">{m.name}</span>
              <span className="font-mono text-[13px]">{t.spot != null && t.spot > 0 ? usd(t.spot) : "—"}</span>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-dim mb-6">
        {!pricesUpdatedAt ? "Prices not yet available" : updatedAtLabel ? `Prices as of ${updatedAtLabel}` : " "}
      </div>

      {/* Vault summary */}
      <section className="flex flex-wrap items-end gap-x-12 gap-y-6 rounded-2xl border border-line bg-gradient-to-br from-raised to-panel px-7 py-6 mb-7">
        <div>
          <div className="text-[11px] uppercase tracking-[0.12em] text-dim mb-1.5">Portfolio value</div>
          <div className="font-mono font-bold text-4xl sm:text-5xl tracking-tight">{usd(totals.value)}</div>
        </div>
        <div className="flex gap-10 flex-wrap pb-1.5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-dim mb-1.5">Market move · 30d</div>
            <div className="font-mono text-[15px]">
              <Delta value={totals.chg30} percent={totals.chg30Pct} />
            </div>
          </div>
        </div>
      </section>

      {/* Value over time */}
      <section className="rounded-2xl border border-hair bg-panel p-5 mb-7">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="text-[11px] uppercase tracking-[0.12em] text-dim">Your holdings, valued over time</div>
          <div className="flex gap-1 rounded-full border border-hair p-0.5">
            {(
              [
                ["7d", "7D"],
                ["1m", "1M"],
                ["1y", "1Y"],
              ] as [Timeframe, string][]
            ).map(([tf, label]) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-mono transition-colors ${
                  timeframe === tf ? "bg-ink text-bg" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {displayHistory.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4FB286" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4FB286" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-hair)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--color-dim)" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis
                  stroke="var(--color-dim)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  domain={[0, yTicks[yTicks.length - 1]]}
                  ticks={yTicks}
                  tickFormatter={formatAxisDollar}
                />
                <Tooltip
                  contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", borderRadius: 10, fontFamily: "var(--font-mono)" }}
                  labelStyle={{ color: "var(--color-muted)" }}
                  labelFormatter={(label: string, payload) =>
                    payload && payload[0] ? (payload[0].payload as { full: string }).full : label
                  }
                  formatter={(v: number) => [usd(v), "Value"]}
                />
                <Area type="monotone" dataKey="value" stroke="#4FB286" strokeWidth={2} fill="url(#pv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted py-10 text-center">
            This chart prices your current holdings against each day&apos;s metal prices, so it fills in as price
            history accumulates.
          </p>
        )}
      </section>

      {/* Composition */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-7">
        <CompositionCard
          title="Composition by worth"
          slices={displayComposition.map((c) => ({ symbol: c.symbol, amount: c.value }))}
          formatTooltip={(v) => usd(v)}
          formatAmount={(v, total) => `${total ? num((v / total) * 100, 1) : "0.0"}%`}
        />
        <CompositionCard
          title="Composition by weight"
          slices={displayWeightComposition.map((w) => ({ symbol: w.symbol, amount: w.ozt }))}
          formatTooltip={(v) => `${num(v, 3)} troy oz fine`}
          formatAmount={(v) => `${num(v, 3)} oz`}
        />
      </div>

      {/* Holdings */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg tracking-wide">Holdings</h2>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg hover:opacity-90"
            >
              + Add holding
            </button>
          )}
        </div>

        {adding && <AddForm onAdd={onAdd} onClose={() => setAdding(false)} />}

        {displayRows.length === 0 && !adding && (
          <div className="text-center text-muted py-10 flex flex-col items-center gap-3.5">
            <p>No metals tracked yet.</p>
            <button
              onClick={() => setAdding(true)}
              className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg hover:opacity-90"
            >
              Add your first holding
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {displayRows.map((r) => (
            <HoldingCard key={r.id} row={r} onUpdate={onUpdate} onDelete={onDelete} onRename={onRename} />
          ))}
        </div>
      </section>

      <footer className="mt-8 text-xs text-dim leading-relaxed">
        Spot prices via Metal Sentinel (Kitco), quoted per troy ounce. Not investment advice. Demo data is not saved.
      </footer>
    </main>
  );
}
