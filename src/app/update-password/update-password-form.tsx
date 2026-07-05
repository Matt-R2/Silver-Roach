"use client";

import { useActionState } from "react";
import { updatePassword } from "./actions";

export function UpdatePasswordForm({ requireCurrentPassword }: { requireCurrentPassword: boolean }) {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    null as null | { error?: string }
  );

  return (
    <main className="min-h-screen grid place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-3xl font-bold tracking-[0.14em] text-ink">
            ASSAY<span className="text-up">.</span>
          </div>
          <p className="mt-2 text-sm text-muted">Choose a new password.</p>
        </div>

        <form action={formAction} className="rounded-2xl border border-line bg-panel p-6 space-y-4">
          {requireCurrentPassword && (
            <div className="space-y-1.5">
              <label htmlFor="currentPassword" className="block text-[11px] uppercase tracking-wider text-muted">
                Current password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-sm text-ink focus:border-up focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-[11px] uppercase tracking-wider text-muted">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-sm text-ink focus:border-up focus:outline-none"
            />
          </div>

          {state?.error && <p className="text-sm text-down">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}
