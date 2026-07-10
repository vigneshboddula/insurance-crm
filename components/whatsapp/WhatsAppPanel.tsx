"use client";

import { useEffect, useState } from "react";
import { MessageCircle, QrCode, CheckCircle2, LogOut, Send, ShieldAlert, Loader2, Sparkles } from "lucide-react";

type Template = { id: string; name: string; category: string; language: string; body: string };
type State = { status: "disconnected" | "initializing" | "qr" | "ready" | "auth_failure"; qr: string | null; me: string | null };

export function WhatsAppPanel({ templates }: { templates: Template[] }) {
  const [state, setState] = useState<State>({ status: "disconnected", qr: null, me: null });
  const [connecting, setConnecting] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [aiOk, setAiOk] = useState(false);
  const [draftAsk, setDraftAsk] = useState("");
  const [draftLang, setDraftLang] = useState<"english" | "telugu">("english");
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try { const r = await fetch("/api/whatsapp/status", { cache: "no-store" }); if (alive) setState(await r.json()); } catch { /* ignore */ }
    };
    poll();
    const t = setInterval(poll, 2500);
    fetch("/api/ai/status").then((r) => r.json()).then((d) => { if (alive) setAiOk(!!d.available); }).catch(() => {});
    return () => { alive = false; clearInterval(t); };
  }, []);

  const draft = async () => {
    if (!draftAsk.trim() || drafting) return;
    setDrafting(true);
    try {
      const r = await fetch("/api/ai/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction: draftAsk, language: draftLang }) });
      const d = await r.json();
      if (d.text) setMessage(d.text);
      else setResult(`✗ ${d.error ?? "Draft failed"}`);
    } catch { setResult("✗ Network error"); }
    setDrafting(false);
  };

  const connect = async () => { setConnecting(true); try { await fetch("/api/whatsapp/connect", { method: "POST" }); } finally { setConnecting(false); } };
  const logout = async () => { await fetch("/api/whatsapp/logout", { method: "POST" }); setState({ status: "disconnected", qr: null, me: null }); };

  const send = async () => {
    if (!phone || !message) return;
    setSending(true); setResult(null);
    try {
      const r = await fetch("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, text: message }) });
      const d = await r.json();
      setResult(d.ok ? "✓ Sent." : `✗ ${d.error ?? "Failed"}`);
    } catch { setResult("✗ Network error"); }
    setSending(false);
  };

  const ready = state.status === "ready";

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">WhatsApp</h1>
        <p className="text-xs text-ink-3">Send from your own number — no third-party. Link once by QR; the session is remembered.</p>
      </div>

      {/* connection */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><MessageCircle size={15} style={{ color: "var(--emerald)" }} /> Connection</h2>

        {ready ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--emerald-50)" }}>
            <CheckCircle2 size={18} style={{ color: "var(--emerald-700)" }} />
            <span className="flex-1 text-sm" style={{ color: "var(--emerald-700)" }}>Connected{state.me ? ` as +${state.me}` : ""}.</span>
            <button onClick={logout} className="btn"><LogOut size={14} /> Disconnect</button>
          </div>
        ) : state.status === "qr" && state.qr ? (
          <div className="mt-3 flex flex-col items-center gap-2 rounded-xl p-4" style={{ background: "var(--surface-2)" }}>
            <QrCode size={16} className="text-ink-3" />
            <img src={state.qr} alt="WhatsApp QR" width={220} height={220} className="rounded-lg bg-white p-2" />
            <p className="text-center text-xs text-ink-3">On your phone: <b>WhatsApp → Settings → Linked devices → Link a device</b>, then scan this.</p>
          </div>
        ) : state.status === "initializing" ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl p-3 text-sm text-ink-2" style={{ background: "var(--surface-2)" }}><Loader2 size={16} className="animate-spin" /> Starting WhatsApp… a QR will appear shortly.</div>
        ) : (
          <div className="mt-3">
            {state.status === "auth_failure" && <p className="mb-2 text-xs" style={{ color: "var(--red-700)" }}>Connection failed — try again.</p>}
            <button onClick={connect} disabled={connecting} className="btn btn-accent">{connecting ? "Starting…" : <><QrCode size={15} /> Connect WhatsApp</>}</button>
          </div>
        )}

        <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px]" style={{ background: "var(--amber-50)", color: "var(--amber-700)" }}>
          <ShieldAlert size={13} className="mt-0.5 shrink-0" />
          <span>Use a <b>dedicated number</b> if you can. Only message clients who expect to hear from you; the app spaces out sends and never bulk-blasts. You&apos;re responsible for using it sensibly.</span>
        </div>
      </section>

      {/* compose */}
      <section className="card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><Send size={15} className="text-ink-3" /> Send a message</h2>
        <div className="mt-3 space-y-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (e.g. 9812345678 or +91…)" className="w-full rounded-xl border bg-surface px-3 py-2 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }} />

          {aiOk && (
            <div className="rounded-xl border p-2.5" style={{ borderColor: "var(--accent-100)", background: "var(--accent-50)" }}>
              <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--accent-700)" }}><Sparkles size={12} /> Draft with AI</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <input value={draftAsk} onChange={(e) => setDraftAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); draft(); } }} placeholder="e.g. gentle renewal reminder, due in 5 days" className="min-w-[200px] flex-1 rounded-lg border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }} />
                <select value={draftLang} onChange={(e) => setDraftLang(e.target.value as "english" | "telugu")} className="rounded-lg border bg-surface px-2 py-1.5 text-xs outline-none" style={{ borderColor: "var(--border-2)" }}>
                  <option value="english">English</option>
                  <option value="telugu">Telugu</option>
                </select>
                <button onClick={draft} disabled={drafting || !draftAsk.trim()} className="btn" style={{ opacity: draftAsk.trim() ? 1 : 0.5 }}>{drafting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Draft</button>
              </div>
            </div>
          )}

          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Type or pick a template below…" className="w-full rounded-xl border bg-surface px-3 py-2 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }} />
          <div className="flex items-center gap-3">
            <button onClick={send} disabled={!ready || sending || !phone || !message} className="btn btn-accent" style={{ opacity: ready ? 1 : 0.5 }}>{sending ? "Sending…" : <><Send size={14} /> Send</>}</button>
            {!ready && <span className="text-xs text-ink-3">Connect first to send.</span>}
            {result && <span className="text-xs" style={{ color: result.startsWith("✓") ? "var(--emerald-700)" : "var(--red-700)" }}>{result}</span>}
          </div>
        </div>
      </section>

      {/* templates */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold text-ink">Templates</h2>
        <p className="text-xs text-ink-3">Click to load into the message box. Personalize {"{{name}}"}, {"{{policyNumber}}"}, etc. before sending.</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {templates.map((t) => (
            <button key={t.id} onClick={() => setMessage(t.body)} className="rounded-xl border p-3 text-left transition hover:bg-surface-2" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2"><span className="text-sm font-medium text-ink">{t.name}</span><span className="pill-gray pill uppercase">{t.language}</span></div>
              <div className="mt-1 line-clamp-2 text-[11px] text-ink-3">{t.body}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
