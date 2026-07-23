"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { updateDisplayName, updateTheme, updateEmail, deleteAccount } from "./actions";
import { Section, inputClass, labelClass } from "./section";
import { ProfileTabs, type ProfileTab } from "./tabs";
import { AlertsSection } from "./alerts-client";

type ActionState = { error?: string; message?: string } | null;

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

export default function ProfileClient({
  email,
  displayName,
  theme,
  alerts,
  holdingOptions,
  spotBySymbol,
}: {
  email: string;
  displayName: string;
  theme: "dark" | "light";
  alerts: Alert[];
  holdingOptions: HoldingOption[];
  spotBySymbol: Record<string, number>;
}) {
  const [tab, setTab] = useState<ProfileTab>("general");

  return (
    <main className="mx-auto max-w-xl px-5 sm:px-8 py-7 pb-16 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-muted hover:text-ink">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-2xl font-bold tracking-[0.1em]">Profile</h1>
      </div>

      <ProfileTabs active={tab} onChange={setTab} />

      {tab === "general" && <ThemeSection initialTheme={theme} />}

      {tab === "profile" && (
        <>
          <DisplayNameSection initialValue={displayName} />
          <EmailSection currentEmail={email} />
          <Section title="Password">
            <p className="text-sm text-muted">
              <Link href="/update-password" className="text-up hover:underline">
                Change your password
              </Link>
            </p>
          </Section>
          <DangerZone />
        </>
      )}

      {tab === "alerts" && (
        <AlertsSection alerts={alerts} holdingOptions={holdingOptions} spotBySymbol={spotBySymbol} />
      )}
    </main>
  );
}

function DisplayNameSection({ initialValue }: { initialValue: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateDisplayName, null);

  return (
    <Section title="Display name">
      <form action={formAction} className="space-y-3">
        <input
          name="displayName"
          defaultValue={initialValue}
          placeholder="Shown instead of your email on the dashboard"
          maxLength={60}
          className={inputClass}
        />
        {state?.error && <p className="text-sm text-down">{state.error}</p>}
        {state?.message && <p className="text-sm text-up">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </Section>
  );
}

function ThemeSection({ initialTheme }: { initialTheme: "dark" | "light" }) {
  const [theme, setTheme] = useState(initialTheme);
  const [pending, startTransition] = useTransition();

  function choose(next: "dark" | "light") {
    if (next === theme) return;
    setTheme(next);
    document.documentElement.dataset.theme = next;
    startTransition(async () => {
      await updateTheme(next);
    });
  }

  return (
    <Section title="Theme">
      <div className="inline-flex rounded-lg border border-line overflow-hidden">
        {(["dark", "light"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={pending}
            onClick={() => choose(option)}
            className={`px-4 py-2 text-sm capitalize transition ${
              theme === option ? "bg-ink text-bg font-semibold" : "text-muted hover:text-ink"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </Section>
  );
}

function EmailSection({ currentEmail }: { currentEmail: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateEmail, null);

  return (
    <Section title="Email">
      <p className="text-sm text-muted">
        Current: <span className="text-ink">{currentEmail}</span>
      </p>
      <form action={formAction} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="newEmail" className={labelClass}>
            New email
          </label>
          <input id="newEmail" name="newEmail" type="email" required autoComplete="email" className={inputClass} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="emailCurrentPassword" className={labelClass}>
            Current password
          </label>
          <input
            id="emailCurrentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </div>
        {state?.error && <p className="text-sm text-down">{state.error}</p>}
        {state?.message && <p className="text-sm text-up">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Working…" : "Update email"}
        </button>
      </form>
    </Section>
  );
}

function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(deleteAccount, null);

  return (
    <Section title="Danger zone" tone="danger">
      {!confirming ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Permanently delete your account and every holding you&apos;ve tracked. This can&apos;t be undone.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-down px-3.5 py-2 text-[13px] font-semibold text-down hover:bg-down/10"
          >
            Delete account
          </button>
        </div>
      ) : (
        <form action={formAction} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="deleteCurrentPassword" className={labelClass}>
              Enter your password to confirm
            </label>
            <input
              id="deleteCurrentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          {state?.error && <p className="text-sm text-down">{state.error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-down px-3.5 py-2 text-[13px] font-semibold text-ink hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg px-3.5 py-2 text-[13px] text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Section>
  );
}
