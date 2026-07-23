"use client";

import { useActionState, useState } from "react";
import { Section, inputClass, labelClass } from "./section";
import { createAlert, toggleAlert, deleteAlert, type ActionState } from "./alerts-actions";
import { METALS, ALL_SYMBOLS, type MetalSymbol } from "@/lib/metals-meta";
import { usd } from "@/lib/units";

type Alert = {
  id: string;
  holdingId: string | null;
  holdingLabel: string | null;
  symbol: string;
  condition: string;
  targetPriceUsd: number;
  active: boolean;
  triggeredAt: Date | null;
};

type HoldingOption = { id: string; symbol: string; label: string; currentValue: number };

export function AlertsSection({
  alerts,
  holdingOptions,
  spotBySymbol,
}: {
  alerts: Alert[];
  holdingOptions: HoldingOption[];
  spotBySymbol: Record<string, number>;
}) {
  return (
    <>
      <NewAlertForm holdingOptions={holdingOptions} spotBySymbol={spotBySymbol} />
      <Section title="Your alerts">
        {alerts.length === 0 ? (
          <p className="text-sm text-muted">No alerts yet.</p>
        ) : (
          <ul className="space-y-3">
            {alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function NewAlertForm({
  holdingOptions,
  spotBySymbol,
}: {
  holdingOptions: HoldingOption[];
  spotBySymbol: Record<string, number>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createAlert, null);
  const [kind, setKind] = useState<"spot" | "holding">("spot");
  const [symbol, setSymbol] = useState<MetalSymbol>(ALL_SYMBOLS[0]);
  const [holdingId, setHoldingId] = useState(holdingOptions[0]?.id ?? "");

  const currentValue =
    kind === "holding"
      ? (holdingOptions.find((h) => h.id === holdingId)?.currentValue ?? null)
      : (spotBySymbol[symbol] ?? null);
  const currentLabel = kind === "holding" ? "Current value" : "Current price";

  return (
    <Section title="New alert">
      <form action={formAction} className="space-y-3">
        {holdingOptions.length > 0 && (
          <div className="inline-flex rounded-lg border border-line overflow-hidden">
            {(["spot", "holding"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`px-4 py-2 text-sm transition ${
                  kind === option ? "bg-ink text-bg font-semibold" : "text-muted hover:text-ink"
                }`}
              >
                {option === "spot" ? "Metal spot price" : "A holding I own"}
              </button>
            ))}
          </div>
        )}

        {kind === "spot" ? (
          <div className="space-y-1.5">
            <label htmlFor="alertSymbol" className={labelClass}>
              Metal
            </label>
            <select
              id="alertSymbol"
              name="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value as MetalSymbol)}
              className={inputClass}
            >
              {ALL_SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {METALS[s].name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="alertHolding" className={labelClass}>
              Holding
            </label>
            <select
              id="alertHolding"
              name="holdingId"
              value={holdingId}
              onChange={(e) => setHoldingId(e.target.value)}
              className={inputClass}
            >
              {holdingOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {currentValue != null && (
          <p className="text-xs text-muted">
            {currentLabel}: <span className="text-ink">{usd(currentValue)}</span>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="alertCondition" className={labelClass}>
              Condition
            </label>
            <select id="alertCondition" name="condition" defaultValue="above" className={inputClass}>
              <option value="above">Goes above</option>
              <option value="below">Goes below</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="alertTargetPrice" className={labelClass}>
              Target (USD)
            </label>
            <input
              id="alertTargetPrice"
              name="targetPriceUsd"
              type="number"
              step="0.01"
              min="0"
              required
              className={inputClass}
            />
          </div>
        </div>

        {state?.error && <p className="text-sm text-down">{state.error}</p>}
        {state?.message && <p className="text-sm text-up">{state.message}</p>}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create alert"}
        </button>
      </form>
    </Section>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const metalName = METALS[alert.symbol]?.name ?? alert.symbol;
  const label = alert.holdingId ? `Your holding: ${alert.holdingLabel ?? "(deleted)"}` : metalName;
  const [toggleState, toggleAction, togglePending] = useActionState<ActionState, FormData>(toggleAlert, null);

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-line px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink">
            {label} {alert.condition} ${alert.targetPriceUsd.toFixed(2)}
          </p>
          <p className={`text-xs ${alert.active ? "text-up" : "text-muted"}`}>
            {alert.active
              ? "Watching"
              : `Triggered ${alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleDateString() : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action={toggleAction}>
            <input type="hidden" name="id" value={alert.id} />
            <input type="hidden" name="active" value={alert.active ? "false" : "true"} />
            <button
              type="submit"
              disabled={togglePending}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-line disabled:opacity-50"
            >
              {alert.active ? "Disable" : "Re-enable"}
            </button>
          </form>
          <form action={deleteAlert}>
            <input type="hidden" name="id" value={alert.id} />
            <button
              type="submit"
              className="rounded-lg border border-down px-3 py-1.5 text-xs font-semibold text-down hover:bg-down/10"
            >
              Delete
            </button>
          </form>
        </div>
      </div>
      {toggleState?.error && <p className="text-xs text-down">{toggleState.error}</p>}
    </li>
  );
}
