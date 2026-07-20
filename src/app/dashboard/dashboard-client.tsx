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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { METALS } from "@/lib/metals-meta";
import { UNIT_LABEL, purityOptionsFor, formatPurity } from "@/lib/units";
import { usd, num, pct } from "@/lib/units";
import { addHolding, deleteHolding, updateHolding, renameHolding } from "./actions";
import { signOut } from "../login/actions";

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
  displayName,
  rows,
  history,
  composition,
  weightComposition,
  ticker,
  pricesUpdatedAt,
}: {
  email: string;
  displayName: string;
  rows: Row[];
  history: SnapshotPoint[];
  composition: CompositionSlice[];
  weightComposition: WeightSlice[];
  ticker: Ticker[];
  pricesUpdatedAt: string | null;
}) {
  const [adding, setAdding] = useState(false);

  // Computed client-side only: toLocaleTimeString/toLocaleDateString resolve
  // against the server's timezone during SSR (Vercel runs in UTC), which
  // doesn't match the visitor's local time. Deferring to an effect means the
  // first client render matches the server-rendered markup exactly, then
  // this fills in with the correct local time right after.
  const [updatedAtLabel, setUpdatedAtLabel] = useState<string | null>(null);
  useEffect(() => {
    if (!pricesUpdatedAt) return;
    const d = new Date(pricesUpdatedAt);
    setUpdatedAtLabel(
      `${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`
    );
  }, [pricesUpdatedAt]);

  const totals = useMemo(() => {
    const value = rows.reduce((a, r) => a + r.value, 0);
    const chg30 = rows.reduce((a, r) => a + (r.chg30Value ?? 0), 0);
    return {
      value,
      chg30,
      chg30Pct: value - chg30 ? chg30 / (value - chg30) : 0,
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

        /* Note starts as a single line like the Label pill, then opens into a
           small rounded box while focused so there's room to write more. */
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
      <header className="flex items-baseline justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-baseline gap-4 flex-wrap">
          <div className="font-display text-2xl font-bold tracking-[0.14em]">
            SILVERROACH<span className="text-up">.</span>
          </div>
          <span className="text-sm text-muted">{displayName || email}</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/profile" className="text-muted hover:text-ink" aria-label="Profile settings">
            <Settings size={16} />
          </Link>
          <form action={signOut}>
            <button className="text-sm text-muted hover:text-ink">Sign out</button>
          </form>
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
        {!pricesUpdatedAt ? "Prices not yet available" : updatedAtLabel ? `Prices as of ${updatedAtLabel}` : " "}
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
        <div className="text-[11px] uppercase tracking-[0.12em] text-dim mb-4">Your holdings, valued over time</div>
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
                <CartesianGrid stroke="var(--color-hair)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--color-dim)" fontSize={11} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis
                  stroke="var(--color-dim)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tickFormatter={(v) => `$${num(v / 1000, 1)}k`}
                />
                <Tooltip
                  contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", borderRadius: 10, fontFamily: "var(--font-mono)" }}
                  labelStyle={{ color: "var(--color-muted)" }}
                  formatter={(v: number) => [usd(v), "Value"]}
                />
                <Area type="monotone" dataKey="value" stroke="#4FB286" strokeWidth={2} fill="url(#pv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted py-10 text-center">
            This chart prices your current holdings against each day&apos;s metal prices, so it fills in as price
            history accumulates. Trigger the price job once (see README) or wait for the scheduled run.
          </p>
        )}
      </section>

      {/* Composition */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-7">
        <CompositionCard
          title="Composition by worth"
          slices={composition.map((c) => ({ symbol: c.symbol, amount: c.value }))}
          formatTooltip={(v) => usd(v)}
          formatAmount={(v, total) => `${total ? num((v / total) * 100, 1) : "0.0"}%`}
        />
        <CompositionCard
          title="Composition by weight"
          slices={weightComposition.map((w) => ({ symbol: w.symbol, amount: w.ozt }))}
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

function CompositionCard({
  title,
  slices,
  formatTooltip,
  formatAmount,
}: {
  title: string;
  slices: { symbol: string; amount: number }[];
  formatTooltip: (v: number) => string;
  formatAmount: (v: number, total: number) => string;
}) {
  const total = slices.reduce((a, s) => a + s.amount, 0);
  return (
    <section className="rounded-2xl border border-hair bg-panel p-5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-dim mb-4">{title}</div>
      {slices.length > 0 ? (
        <div className="flex items-center gap-4">
          <div className="w-[40%] h-40 flex-none">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="symbol"
                  innerRadius={44}
                  outerRadius={68}
                  paddingAngle={2}
                  stroke="none"
                >
                  {slices.map((s) => (
                    <Cell key={s.symbol} fill={METALS[s.symbol].color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", borderRadius: 10, fontFamily: "var(--font-mono)" }}
                  formatter={(v: number, _n, entry) => [formatTooltip(v), METALS[entry.payload.symbol]?.name ?? entry.payload.symbol]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {slices.map((s) => (
              <div key={s.symbol} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: METALS[s.symbol].color }} />
                <span className="text-muted truncate">{METALS[s.symbol].name}</span>
                <span className="font-mono ml-auto">{formatAmount(s.amount, total)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted py-10 text-center">Add a holding to see your composition.</p>
      )}
    </section>
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

function NicknameInline({ id, nickname }: { id: string; nickname: string | null }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        title="Click to rename"
        aria-label="Rename holding"
        onClick={() => setEditing(true)}
        className="text-dim hover:text-ink text-[11px]"
      >
        ✎
      </button>
    );
  }

  return (
    <form
      action={async (fd) => {
        await renameHolding(fd);
        setEditing(false);
      }}
      className="inline-flex items-center gap-1"
    >
      <input type="hidden" name="id" value={id} />
      <input
        name="nickname"
        defaultValue={nickname ?? ""}
        placeholder="e.g. Coins"
        maxLength={40}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        className="rounded-md border border-line bg-bg px-2 py-1 text-[12.5px] font-mono text-ink focus:border-up focus:outline-none"
        style={{ minWidth: 110 }}
      />
      <button type="submit" aria-label="Save name" className="grid place-items-center w-5 h-5 rounded text-up hover:opacity-80">
        ✓
      </button>
      <button
        type="button"
        aria-label="Cancel rename"
        onClick={() => setEditing(false)}
        className="grid place-items-center w-5 h-5 rounded text-dim hover:text-ink"
      >
        ×
      </button>
    </form>
  );
}

function HoldingCard({ row: r }: { row: Row }) {
  const m = METALS[r.symbol];
  const isAlloyed = r.purity < 0.999;
  const [editing, setEditing] = useState(false);

  return (
    <article className="relative grid items-center gap-4 rounded-2xl border border-hair bg-panel pl-5 pr-20 py-4 overflow-hidden sm:grid-cols-[1.4fr_1fr]">
      <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: m.color, opacity: 0.85 }} />
      <div className="flex items-center gap-3">
        <Chip symbol={r.symbol} />
        <div>
          <div className="font-semibold text-[15px] flex items-center gap-1.5 flex-wrap">
            {m.name}
            {r.nickname && <span className="text-muted font-normal">– {r.nickname}</span>}
            <NicknameInline id={r.id} nickname={r.nickname} />
            {r.quantity > 1 && <span className="text-muted font-normal">× {r.quantity}</span>}
            {isAlloyed && (
              <span className="rounded-full border border-hair px-1.5 py-0.5 text-[10px] font-mono text-muted">
                {formatPurity(r.symbol, r.purity)}
              </span>
            )}
          </div>
          <div className="font-mono text-[11.5px] text-muted">
            {num(r.ozt, 3)} troy oz fine <span className="text-dim mx-1">·</span> {num(r.weight, 2)} {UNIT_LABEL[r.unit]}
            {r.quantity > 1 ? ` ea` : ""}
            <span className="text-dim mx-1">·</span> {r.spot > 0 ? `${usd(r.spot)}/ozt` : "price unavailable"}
          </div>
          {r.note && <div className="font-mono text-[10.5px] text-dim mt-0.5 max-w-[36ch] truncate">{r.note}</div>}
        </div>
      </div>

      <div className="sm:text-right">
        <div className="font-mono font-bold text-xl">{r.spot > 0 ? usd(r.value) : <span className="text-muted">—</span>}</div>
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
      </div>

      <div className="absolute top-3 right-3 flex gap-1.5">
        <button
          type="button"
          aria-label="Edit holding"
          onClick={() => setEditing((v) => !v)}
          className={`grid place-items-center w-6 h-6 rounded-md border text-[13px] ${
            editing ? "border-ink text-ink" : "border-hair text-dim hover:text-ink hover:border-ink"
          }`}
        >
          ✎
        </button>
        <form
          action={deleteHolding}
          onSubmit={(e) => {
            if (!confirm(`Remove ${num(r.weight, 2)} ${UNIT_LABEL[r.unit]} of ${m.name}? This can't be undone.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={r.id} />
          <button
            aria-label="Remove holding"
            className="grid place-items-center w-6 h-6 rounded-md border border-hair text-dim hover:text-down hover:border-down"
          >
            ×
          </button>
        </form>
      </div>

      {editing && (
        <form
          action={async (fd) => {
            await updateHolding(fd);
            setEditing(false);
          }}
          className="sm:col-span-2 flex flex-wrap items-end gap-3.5 rounded-xl border border-line bg-raised px-4 py-3.5"
        >
          <input type="hidden" name="id" value={r.id} />
          <HoldingFields
            defaultSymbol={r.symbol}
            defaultWeight={r.weight}
            defaultUnit={r.unit}
            defaultQuantity={r.quantity}
            defaultPurity={r.purity}
          />
          <NoteField defaultValue={r.note ?? ""} />
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-line px-3.5 py-2 text-[13px] text-muted hover:text-ink"
            >
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg hover:opacity-90">
              Save
            </button>
          </div>
        </form>
      )}
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
      <HoldingFields />
      <NoteField />
      <div className="flex gap-2 ml-auto">
        <button type="button" onClick={onClose} className="rounded-lg border border-line px-3.5 py-2 text-[13px] text-muted hover:text-ink">
          Cancel
        </button>
        <button type="submit" className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg hover:opacity-90">
          Add
        </button>
      </div>
    </form>
  );
}

function HoldingFields({
  defaultSymbol = "AG",
  defaultWeight,
  defaultUnit = "ozt",
  defaultQuantity = 1,
  defaultPurity = 1,
}: {
  defaultSymbol?: string;
  defaultWeight?: number;
  defaultUnit?: string;
  defaultQuantity?: number;
  defaultPurity?: number;
}) {
  const [symbol, setSymbol] = useState(defaultSymbol);
  const purityOptions = useMemo(() => purityOptionsFor(symbol), [symbol]);

  return (
    <>
      <Field label="Metal">
        <select name="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="ms-input">
          {Object.keys(METALS).map((s) => (
            <option key={s} value={s}>
              {METALS[s].name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Weight per piece">
        <input
          name="weight"
          type="number"
          min="0"
          step="any"
          defaultValue={defaultWeight}
          placeholder="0.00"
          required
          className="ms-input"
        />
      </Field>
      <Field label="Unit">
        <select name="unit" defaultValue={defaultUnit} className="ms-input">
          <option value="ozt">troy oz</option>
          <option value="g">grams</option>
          <option value="kg">kilograms</option>
        </select>
      </Field>
      <Field label="Quantity">
        <input
          name="quantity"
          type="number"
          min="1"
          step="1"
          defaultValue={defaultQuantity}
          className="ms-input"
          style={{ minWidth: 80 }}
        />
      </Field>
      <Field label={symbol === "AU" ? "Purity (karat)" : "Purity (fineness)"}>
        <select name="purity" defaultValue={defaultPurity} key={symbol} className="ms-input" style={{ minWidth: 150 }}>
          {purityOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    </>
  );
}

function NoteField({ defaultValue }: { defaultValue?: string }) {
  const [open, setOpen] = useState(!!defaultValue);
  // Only steal focus when the user just revealed the field themselves —
  // not when it starts open because the holding already has a note (that'd
  // fight the rename pencil for focus when both start "open" at once).
  const [justOpened, setJustOpened] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setJustOpened(true);
        }}
        className="text-xs text-muted hover:text-ink underline decoration-dotted underline-offset-4"
      >
        + Add note
      </button>
    );
  }

  return (
    <Field label="Note (optional)">
      <textarea
        name="note"
        defaultValue={defaultValue ?? ""}
        placeholder="Any details worth remembering..."
        maxLength={280}
        rows={1}
        autoFocus={justOpened}
        className="ms-pill-input"
        style={{ minWidth: 260, textAlign: "left" }}
      />
    </Field>
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
