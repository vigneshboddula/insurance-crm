"use client";

import { useState, useTransition } from "react";
import { Zap, Send, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { updateEngineSettings, sendTestDigest } from "@/app/settings/actions";

type Props = {
  enabled: boolean;
  agentWhatsApp: string | null;
  digestHour: number;
  connectedNumber: string | null;
  lastTickAt: string | null;
  lastDigestOn: string | null;
};

function fmtHour(h: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${suffix}`;
}

export function EngineCard({ enabled, agentWhatsApp, digestHour, connectedNumber, lastTickAt, lastDigestOn }: Props) {
  const [on, setOn] = useState(enabled);
  const [saving, startSave] = useTransition();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string; preview: string } | null>(null);

  async function runTest() {
    setTesting(true);
    setResult(null);
    try {
      const r = await sendTestDigest();
      setResult(r);
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : "Failed", preview: "" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Zap size={15} style={{ color: "var(--accent)" }} /> Automation engine
          </h2>
          <p className="mt-1 text-xs text-ink-3">
            Runs quietly in the background while the CRM is open. Each morning it sends a digest of what needs
            your attention — <strong>to your own WhatsApp only</strong>. It never messages clients on its own.
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={on ? { background: "var(--emerald-50)", color: "var(--emerald-700)" } : { background: "var(--surface-3)", color: "var(--ink-3)" }}
        >
          {on ? "On" : "Off"}
        </span>
      </div>

      <form action={(fd) => startSave(() => updateEngineSettings(fd))} className="mt-4 space-y-4">
        {/* master switch */}
        <label className="flex cursor-pointer items-center justify-between rounded-xl p-3.5" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
          <span className="text-sm font-medium text-ink">Enable the background engine</span>
          <span className="relative inline-flex">
            <input
              type="checkbox"
              name="engineEnabled"
              checked={on}
              onChange={(e) => setOn(e.target.checked)}
              className="sr-only"
            />
            <span className="h-6 w-11 rounded-full transition-colors" style={{ background: on ? "var(--accent)" : "var(--border-2)" }} />
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </span>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Send the daily digest to</span>
            <input
              name="agentWhatsApp"
              defaultValue={agentWhatsApp ?? ""}
              placeholder={connectedNumber ? `${connectedNumber} (connected)` : "Your WhatsApp number"}
              className="w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm"
              style={{ borderColor: "var(--border-2)" }}
            />
            <span className="mt-1 block text-[11px] text-ink-3">Leave blank to use your connected WhatsApp number.</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-2">Digest time</span>
            <select name="digestHour" defaultValue={String(digestHour)} className="w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm" style={{ borderColor: "var(--border-2)" }}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{fmtHour(h)}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-ink-3">Sent once each day, around this time.</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-ink-3">
            <Info size={12} />
            <span>
              {lastTickAt ? `Engine last ran ${new Date(lastTickAt).toLocaleString("en-IN")}` : "Engine starts when the app boots"}
              {lastDigestOn ? ` · last digest ${lastDigestOn}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={runTest} disabled={testing} className="btn">
              <Send size={14} /> {testing ? "Sending…" : "Send test digest"}
            </button>
            <button type="submit" disabled={saving} className="btn btn-accent">{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>

      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm" style={result.ok ? { background: "var(--emerald-50)", color: "var(--emerald-700)" } : { background: "var(--amber-50)", color: "var(--amber-700)" }}>
            {result.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {result.ok ? "Test digest sent to your WhatsApp." : result.error}
          </div>
          {result.preview && (
            <pre className="whitespace-pre-wrap rounded-xl p-3.5 text-xs text-ink-2" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>{result.preview}</pre>
          )}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-[11px]" style={{ background: "var(--accent-50)", color: "var(--accent-700)" }}>
        <Zap size={14} className="mt-0.5 shrink-0" />
        <span><strong>Keep it always-on:</strong> the engine only runs while the CRM window is open. Run <code>Create Desktop Shortcut.cmd</code> once and choose start-at-login so the CRM (and this engine) come up automatically whenever your PC does.</span>
      </div>
    </section>
  );
}
