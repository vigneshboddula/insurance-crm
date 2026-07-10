"use client";

import { useState, useTransition } from "react";
import { Send, HandMetal, Bot, MoonStar, ShieldCheck } from "lucide-react";
import { updateAutoSendSettings } from "@/app/settings/actions";

type Props = {
  renewalSendMode: string; // "approve" | "auto"
  autoSendDailyCap: number;
  quietStart: number;
  quietEnd: number;
  engineEnabled: boolean;
  autoSentToday: number;
  lastAutoSendAt: string | null;
};

function fmtHour(h: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${suffix}`;
}

export function AutoSendCard({ renewalSendMode, autoSendDailyCap, quietStart, quietEnd, engineEnabled, autoSentToday, lastAutoSendAt }: Props) {
  const [mode, setMode] = useState(renewalSendMode === "auto" ? "auto" : "approve");
  const [saving, startSave] = useTransition();

  return (
    <section className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Send size={15} style={{ color: "var(--accent)" }} /> Auto-send cadence
      </h2>
      <p className="mt-1 text-xs text-ink-3">
        How routine client messages go out. <strong>Approve</strong> keeps you in control — the engine queues each
        message for a one-tap send. <strong>Auto</strong> lets the engine send them for you, but only inside the safety
        limits below. Auto-send only runs while the automation engine is on.
      </p>

      {!engineEnabled && (
        <div className="mt-3 rounded-xl px-3.5 py-2 text-[11px]" style={{ background: "var(--amber-50)", color: "var(--amber-700)" }}>
          The automation engine is off, so nothing auto-sends yet. Turn it on above to activate Auto categories.
        </div>
      )}

      <form action={(fd) => startSave(() => updateAutoSendSettings(fd))} className="mt-4 space-y-4">
        {/* per-category dial */}
        <input type="hidden" name="renewalSendMode" value={mode} />
        <div className="rounded-xl p-3.5" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-ink">Renewal reminders</div>
              <div className="text-[11px] text-ink-3">The 1-month → grace-period cadence per policy.</div>
            </div>
            <div className="flex shrink-0 overflow-hidden rounded-lg" style={{ border: "0.5px solid var(--border-2)" }}>
              <button
                type="button"
                onClick={() => setMode("approve")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                style={mode === "approve" ? { background: "var(--accent)", color: "#fff" } : { color: "var(--ink-2)" }}
              >
                <HandMetal size={13} /> Approve
              </button>
              <button
                type="button"
                onClick={() => setMode("auto")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors"
                style={mode === "auto" ? { background: "var(--accent)", color: "#fff" } : { color: "var(--ink-2)" }}
              >
                <Bot size={13} /> Auto
              </button>
            </div>
          </div>
          {mode === "auto" && (
            <div className="mt-2.5 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: "var(--accent-50)", color: "var(--accent-700)" }}>
              <ShieldCheck size={13} className="mt-0.5 shrink-0" />
              Reminders will send automatically — respecting quiet hours and your daily cap. You can still send early from the Renewals page anytime.
            </div>
          )}
        </div>

        {/* safety limits */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-2"><MoonStar size={12} /> Quiet from</span>
            <select name="quietStart" defaultValue={String(quietStart)} className="w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border-2)" }}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-2"><MoonStar size={12} /> Quiet until</span>
            <select name="quietEnd" defaultValue={String(quietEnd)} className="w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border-2)" }}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{fmtHour(h)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Daily send cap</span>
            <input name="autoSendDailyCap" type="number" min={1} max={500} defaultValue={autoSendDailyCap} className="w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border-2)" }} />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-ink-3">
            Auto-sent today: <span className="tnum font-medium text-ink-2">{autoSentToday}</span> / {autoSendDailyCap}
            {lastAutoSendAt ? ` · last ${new Date(lastAutoSendAt).toLocaleString("en-IN")}` : ""}
          </div>
          <button type="submit" disabled={saving} className="btn btn-accent">{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </section>
  );
}
