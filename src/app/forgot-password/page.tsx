"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    null as null | { error?: string; message?: string }
  );

  return (
    <main className="min-h-screen grid place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-3xl font-bold tracking-[0.14em] text-ink">
            ASSAY<span className="text-up">.</span>
          </div>
          <p className="mt-2 text-sm text-muted">Reset your password.</p>
        </div>

        <form action={formAction} className="rounded-2xl border border-line bg-panel p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-[11px] uppercase tracking-wider text-muted">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-sm text-ink focus:border-up focus:outline-none"
            />
          </div>

          {state?.error && <p className="text-sm text-down">{state.error}</p>}
          {state?.message && <p className="text-sm text-up">{state.message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <Link href="/login" className="mt-4 block text-center text-sm text-muted hover:text-ink">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
