"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, signUp } from "./actions";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(searchParams.get("mode") === "signup" ? "signup" : "signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<
    { error?: string; message?: string } | null,
    FormData
  >(action, null);

  return (
    <main className="min-h-screen grid place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-display text-3xl font-bold tracking-[0.14em] text-ink">
            SILVER ROACH<span className="text-up">.</span>
          </div>
          <p className="mt-2 text-sm text-muted">Track what your metals are worth over time.</p>
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

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-[11px] uppercase tracking-wider text-muted">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 font-mono text-sm text-ink focus:border-up focus:outline-none"
            />
            {mode === "signin" && (
              <Link href="/forgot-password" className="block text-right text-xs text-muted hover:text-ink">
                Forgot password?
              </Link>
            )}
          </div>

          {state?.error && <p className="text-sm text-down">{state.error}</p>}
          {state?.message && <p className="text-sm text-up">{state.message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-center text-sm text-muted hover:text-ink"
        >
          {mode === "signin" ? "Need an account? Create one" : "Have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
