"use client";

import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { METALS } from "@/lib/metals-meta";
import { UNIT_LABEL, purityOptionsFor, formatPurity } from "@/lib/units";
import { usd, num, pct } from "@/lib/units";
import type { Row } from "@/lib/portfolio";

// Presentational + form pieces shared by the real dashboard and the demo
// dashboard. Mutations are passed in as FormData-accepting callbacks so the
// same components can either call the real server actions or update local
// (unsaved) state, depending on the caller.
type FormAction = (formData: FormData) => void | Promise<void>;

export function Chip({ symbol }: { symbol: string }) {
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

export function Delta({ value, percent }: { value: number; percent: number }) {
  const up = value >= 0;
  return (
    <span className={`font-mono whitespace-nowrap ${up ? "text-up" : "text-down"}`}>
      <span className="text-[9px] mr-0.5">{up ? "▲" : "▼"}</span>
      {usd(Math.abs(value))} <span className="opacity-70">{pct(percent)}</span>
    </span>
  );
}

export function CompositionCard({
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

function NicknameInline({ id, nickname, onRename }: { id: string; nickname: string | null; onRename: FormAction }) {
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
        await onRename(fd);
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

export function HoldingCard({
  row: r,
  onUpdate,
  onDelete,
  onRename,
}: {
  row: Row;
  onUpdate: FormAction;
  onDelete: FormAction;
  onRename: FormAction;
}) {
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
            <NicknameInline id={r.id} nickname={r.nickname} onRename={onRename} />
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
          action={onDelete}
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
            await onUpdate(fd);
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

export function AddForm({ onAdd, onClose }: { onAdd: FormAction; onClose: () => void }) {
  return (
    <form
      action={async (fd) => {
        await onAdd(fd);
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
