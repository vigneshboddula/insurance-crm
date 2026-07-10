"use client";

import { useState, useTransition } from "react";
import { Lock, KeyRound, CheckCircle2 } from "lucide-react";
import { setAppPasscode } from "@/app/lock-actions";

export function AppLockCard({ enabled }: { enabled: boolean }) {
  const [, start] = useTransition();
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (removing) fd.set("next", "");
    const form = e.currentTarget;
    start(async () => {
      const r = await setAppPasscode(fd);
      if (r.error) setMsg({ text: r.error });
      else { setMsg({ ok: true, text: removing ? "App lock removed." : "App lock is on. You'll be asked for the passcode after 30 minutes idle or on restart." }); form.reset(); setRemoving(false); }
    });
  };

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Lock size={15} style={{ color: "var(--accent-700)" }} /> App lock</h2>
      <p className="mt-1 text-xs text-ink-3">
        {enabled
          ? "A passcode is required to open the app (auto-locks after 30 minutes idle). Vault reveals are also recorded in the audit trail."
          : "Set a passcode so anyone at this PC can't open your client book. Auto-locks after 30 minutes idle."}
      </p>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        {enabled && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Current passcode</span>
            <input name="current" type="password" required className="rounded-lg border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }} />
          </label>
        )}
        {!removing && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">{enabled ? "New passcode" : "Passcode (min 4)"}</span>
            <input name="next" type="password" required minLength={4} className="rounded-lg border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }} />
          </label>
        )}
        <button type="submit" className="btn btn-accent"><KeyRound size={14} /> {removing ? "Remove lock" : enabled ? "Change passcode" : "Turn on app lock"}</button>
        {enabled && (
          <button type="button" onClick={() => { setRemoving((v) => !v); setMsg(null); }} className="btn">{removing ? "Keep the lock" : "Remove lock…"}</button>
        )}
      </form>
      {msg && (
        <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: msg.ok ? "var(--emerald-700)" : "var(--red-700)" }}>
          {msg.ok && <CheckCircle2 size={13} />} {msg.text}
        </p>
      )}
    </section>
  );
}
