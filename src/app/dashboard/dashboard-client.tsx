"use client";

import { useMemo, useState } from "react";
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
import { UNIT_LABEL } from "@/lib/units";
import { usd, num, pct } from "@/lib/units";
import { addHolding, deleteHolding } from "./actions";
import { signOut } from "../login/actions";

export type Row = {
  id: string;
  symbol: string;
  weight: number;
  unit: string;
  paid: number | null;
  ozt: number;
  spot: number;
  value: number;
  chg30Value: number | null;
  chg30Pct: number | null;
  chg1yValue: number | null;
  chg1yPct: number | null;
  gain: number | null;
  gainPct: number | null;
};

export type SnapshotPoint = { t: string; value: number };
type Ticker = { symbol: string; spot: number | null };

function Delta({ value, percent }: { value: number; percent: number }) {
  const up = value >= 0;
  return (
    <span className={`font-mono whitespace-nowrap ${up ? "text-up" : "text-down"}`}>
      <span className="text-[9px] mr-0.5">{up ? "▲" : "▼"}</span>
      {usd(Math.abs(value))} <span className="opacity-70">{pct(percent)}</span>
    </span>
  );
}

export default function DashboardClient({
  email,
  rows,
  history,
  ticker,
}: {
  email: string;
  rows: Row[];
  history: SnapshotPoint[];
  ticker: Ticker[];
}) {
  const [adding, setAdding] = useState(false);

  const totals = useMemo(() => {
    const value = rows.reduce((a, r) => a + r.value, 0);
    const chg30 = rows.reduce((a, r) => a + (r.chg30Value ?? 0), 0);
    const cost = rows.reduce((a, r) => a + (r.paid ?? 0), 0);
    const gain = rows.filter((r) => r.gain != null).reduce((a, r) => a + (r.gain ?? 0), 0);
    return {
      value,
      chg30,
      chg30Pct: value - chg30 ? chg30 / (value - chg30) : 0,
      gain,
      gainPct: cost ? gain / cost : 0,
      hasCost: cost > 0,
    };
  }, [rows]);

  const chartData = useMemo(
    () =>
      history.map((p) => ({
        date: new Date(p.t).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: Math.round(p.value),
      })),
    [history]
  );

  return (
    <main className="mx-auto max-w-5xl px-5 sm:px-8 py-7 pb-16">
      <header className="flex items-baseline justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-baseline gap-4 flex-wrap">
          <div className="font-display text-2xl font-bold tracking-[0.14em]">
            ASSAY<span className="text-up">.</span>
          </div>
          <span className="text-sm text-muted">{email}</span>
        </div>
        <form action={signOut}>
          <button className="text-sm text-muted hover:text-ink">Sign out</button>
        </form>
      </header>

      {/* Spot ticker */}
      <div className="flex gap-2.5 overflow-x-auto pb-1.5 mb-6 scroll-x">
        {ticker.map((t) => {
          const m = METALS[t.symbol];
          return (
            <div
              key={t.symbol}
              className="flex items-center gap-2 flex-none rounded-[10px] border border-hair bg-panel px-3 py-2"
            >
              <Chip symbol={t.symbol} />
              <span className="text-xs text-muted">{m.name}</span>
              <span className="font-mono text-[13px]">{t.spot != null ? usd(t.spot) : "—"}</span>
            </div>
          );
        })}
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
          {totals.hasCost && (
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-dim mb-1.5">Unrealized · vs cost</div>
              <div className="font-mono text-[15px]">
                <Delta value={totals.gain} percent={totals.gainPct} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Portfolio value over time */}
      <section className="rounded-2xl border border-hair bg-panel p-5 mb-7">
        <div className="text-[11px] uppercase tracking-[0.12em] text-dim mb-4">Portfolio value over time</div>
        {chartData.length >= 2 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4FB286" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#4FB286" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#242A31" vertical={false} />
                <XAxis dataKey="date" stroke="#5C646E" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis
                  stroke="#5C646E"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v) => `$${num(v / 1000, 1)}k`}
                />
                <Tooltip
                  contentStyle={{ background: "#1B1F24", border: "1px solid #2C333B", borderRadius: 10, fontFamily: "var(--font-mono)" }}
                  labelStyle={{ color: "#8A929C" }}
                  formatter={(v: number) => [usd(v), "Value"]}
                />
                <Area type="monotone" dataKey="value" stroke="#4FB286" strokeWidth={2} fill="url(#pv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted py-10 text-center">
            Your value chart fills in as daily snapshots accumulate. The first one is written by the snapshot job —
            run it once (see README) or wait for the scheduled run.
          </p>
        )}
      </section>

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

        {adding && <AddForm onClose={() => setAdding(false)} />}

        {rows.length === 0 && !adding && (
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
          {rows.map((r) => (
            <HoldingCard key={r.id} row={r} />
          ))}
        </div>
      </section>

      <footer className="mt-8 text-xs text-dim leading-relaxed">
        Spot prices via Metal Sentinel (Kitco), quoted per troy ounce. Not investment advice.
      </footer>
    </main>
  );
}

function Chip({ symbol }: { symbol: string }) {
  const m = METALS[symbol];
  return (
    <span
      className="grid place-items-center rounded-full font-mono font-bold text-[12px]"
      style={{
        width: 28,
        height: 28,
        color: m.color,
        background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${m.color} 40%, transparent)`,
      }}
    >
      {m.glyph}
    </span>
  );
}

function HoldingCard({ row: r }: { row: Row }) {
  const m = METALS[r.symbol];
  return (
    <article className="relative grid items-center gap-4 rounded-2xl border border-hair bg-panel pl-5 pr-11 py-4 overflow-hidden sm:grid-cols-[1.4fr_1fr]">
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: m.color, opacity: 0.85 }} />
      <div className="flex items-center gap-3">
        <Chip symbol={r.symbol} />
        <div>
          <div className="font-semibold text-[15px]">{m.name}</div>
          <div className="font-mono text-[11.5px] text-muted">
            {num(r.ozt, 3)} troy oz <span className="text-dim mx-1">·</span> {num(r.weight, 2)} {UNIT_LABEL[r.unit]}
            <span className="text-dim mx-1">·</span> {usd(r.spot)}/ozt
          </div>
        </div>
      </div>

      <div className="sm:text-right">
        <div className="font-mono font-bold text-xl">{usd(r.value)}</div>
        <div className="flex gap-x-4 gap-y-1 flex-wrap sm:justify-end mt-1 text-xs items-baseline">
          {r.chg30Value != null && r.chg30Pct != null && (
            <span className="flex items-baseline gap-1.5">
              <Delta value={r.chg30Value} percent={r.chg30Pct} />
              <span className="text-dim text-[10px]">30d</span>
            </span>
          )}
          {r.chg1yValue != null && r.chg1yPct != null && (
            <span className="flex items-baseline gap-1.5">
              <Delta value={r.chg1yValue} percent={r.chg1yPct} />
              <span className="text-dim text-[10px]">1y</span>
            </span>
          )}
        </div>
        {r.gain != null && r.gainPct != null && (
          <div className={`font-mono text-[11px] mt-1 ${r.gain >= 0 ? "text-up" : "text-down"}`}>
            {r.gain >= 0 ? "Up" : "Down"} {usd(Math.abs(r.gain))} ({pct(r.gainPct)}) vs {usd(r.paid ?? 0)} paid
          </div>
        )}
      </div>

      <form action={deleteHolding} className="absolute top-3 right-3">
        <input type="hidden" name="id" value={r.id} />
        <button
          aria-label="Remove holding"
          className="grid place-items-center w-6 h-6 rounded-md border border-hair text-dim hover:text-down hover:border-down"
        >
          ×
        </button>
      </form>
    </article>
  );
}

function AddForm({ onClose }: { onClose: () => void }) {
  return (
    <form
      action={async (fd) => {
        await addHolding(fd);
        onClose();
      }}
      className="flex flex-wrap items-end gap-3.5 rounded-2xl border border-line bg-raised px-5 py-4 mb-4"
    >
      <Field label="Metal">
        <select name="symbol" defaultValue="AG" className="ms-input">
          {Object.keys(METALS).map((s) => (
            <option key={s} value={s}>
              {METALS[s].name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Weight">
        <input name="weight" type="number" min="0" step="any" placeholder="0.00" required className="ms-input" />
      </Field>
      <Field label="Unit">
        <select name="unit" defaultValue="ozt" className="ms-input">
          <option value="ozt">troy oz</option>
          <option value="g">grams</option>
          <option value="kg">kilograms</option>
        </select>
      </Field>
      <Field label="Amount paid (optional)">
        <input name="paid" type="number" min="0" step="any" placeholder="total $" className="ms-input" />
      </Field>
      <div className="flex gap-2 ml-auto">
        <button type="button" onClick={onClose} className="rounded-lg border border-line px-3.5 py-2 text-[13px] text-muted hover:text-ink">
          Cancel
        </button>
        <button type="submit" className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg hover:opacity-90">
          Add
        </button>
      </div>

      <style>{`
        .ms-input {
          font-family: var(--font-mono); font-size: 14px; color: #ECEFF2;
          background: #131619; border: 1px solid #2C333B; border-radius: 8px;
          padding: 9px 11px; min-width: 120px;
        }
        .ms-input:focus { border-color: #4FB286; outline: none; }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  );
}
