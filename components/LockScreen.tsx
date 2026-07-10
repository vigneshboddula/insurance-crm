"use client";

import { useActionState } from "react";
import { Shield, Lock, ArrowRight } from "lucide-react";
import { unlockApp } from "@/app/lock-actions";

export function LockScreen() {
  const [state, action, pending] = useActionState(unlockApp, null);

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--paper, #faf8f3)" }}>
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--accent)" }}>
          <Shield size={26} className="text-white" />
        </div>
        <h1 className="text-lg font-semibold text-ink">Insurance CRM is locked</h1>
        <p className="mt-1 text-xs text-ink-3">Enter your passcode to continue. Client data stays encrypted on this PC.</p>

        <form action={action} className="mt-5 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border bg-surface px-3" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }}>
            <Lock size={15} className="shrink-0 text-ink-4" />
            <input
              name="passcode"
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder="Passcode"
              className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-ink-4"
            />
          </div>
          {state?.error && <p className="text-xs" style={{ color: "var(--red-700)" }}>{state.error}</p>}
          <button type="submit" disabled={pending} className="btn btn-accent w-full justify-center py-3" style={{ opacity: pending ? 0.7 : 1 }}>
            {pending ? "Checking…" : <>Unlock <ArrowRight size={15} /></>}
          </button>
        </form>

        <p className="mt-6 text-[11px] text-ink-4">Forgot it? It can be reset from the PC itself — ask your developer.</p>
      </div>
    </div>
  );
}
