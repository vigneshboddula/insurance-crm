"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2, X, RefreshCw, Send, ExternalLink, Paperclip } from "lucide-react";
import { waLink } from "@/lib/links";
import { labelOf, DOC_TYPES } from "@/lib/enums";

type Doc = { id: string; fileName: string; type: string; label: string | null };

type Props = {
  clientId: string;
  name: string;
  phone?: string | null;
  /** What the message should say — prefilled into the instruction box. */
  purpose: string;
  subject?: string; // logged with the WhatsApp send
  /** Pass from a parent that already checked status, to avoid N status calls. */
  available?: boolean;
  /** Icon-only trigger (for tight rows). */
  compact?: boolean;
  /** Custom trigger label instead of "Draft with AI" (e.g. "Send Payment Link"). */
  label?: string;
  /** Render the labelled trigger in a red/primary style. */
  danger?: boolean;
};

export function AiDraftButton({ clientId, name, phone, purpose, subject = "Message", available, compact, label, danger }: Props) {
  const [ok, setOk] = useState(available ?? false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (available !== undefined) { setOk(available); return; }
    let alive = true;
    fetch("/api/ai/status").then((r) => r.json()).then((d) => { if (alive) setOk(!!d.available); }).catch(() => {});
    return () => { alive = false; };
  }, [available]);

  if (!ok) return null;

  return (
    <>
      {compact ? (
        <button onClick={() => setOpen(true)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-50)", color: "var(--accent-700)" }} aria-label="Draft with AI" title="Draft with AI">
          <Sparkles size={13} />
        </button>
      ) : label ? (
        <button onClick={() => setOpen(true)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90" style={{ background: danger ? "var(--red)" : "var(--accent)" }}>{label}</button>
      ) : (
        <button onClick={() => setOpen(true)} className="btn"><Sparkles size={14} style={{ color: "var(--accent-700)" }} /> Draft with AI</button>
      )}
      {open && <Dialog clientId={clientId} name={name} phone={phone} purpose={purpose} subject={subject} onClose={() => setOpen(false)} />}
    </>
  );
}

function Dialog({ clientId, name, phone, purpose, subject, onClose }: { clientId: string; name: string; phone?: string | null; purpose: string; subject: string; onClose: () => void }) {
  const [instruction, setInstruction] = useState(purpose);
  const [lang, setLang] = useState<"english" | "telugu">("english");
  const [text, setText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [waReady, setWaReady] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [attachId, setAttachId] = useState("");
  const [result, setResult] = useState<string | null>(null);

  // know whether to send via the linked number or fall back to wa.me
  useEffect(() => {
    fetch("/api/whatsapp/status").then((r) => r.json()).then((d) => setWaReady(d.status === "ready")).catch(() => {});
    fetch(`/api/clients/${clientId}/docs`).then((r) => r.json()).then((d) => setDocs(d.docs ?? [])).catch(() => {});
  }, [clientId]);

  const draft = async () => {
    if (!instruction.trim() || drafting) return;
    setDrafting(true); setResult(null);
    try {
      const r = await fetch("/api/ai/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, instruction, language: lang }) });
      const d = await r.json();
      if (d.text) setText(d.text); else setResult(`✗ ${d.error ?? "Draft failed"}`);
    } catch { setResult("✗ Network error"); }
    setDrafting(false);
  };

  // auto-draft on open
  useEffect(() => { draft(); /* eslint-disable-next-line */ }, []);

  const canSend = (!!text.trim() || !!attachId) && !!phone;

  const send = async () => {
    if (!canSend || sending) return;
    setSending(true); setResult(null);
    if (waReady) {
      try {
        const r = await fetch("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, text, clientId, subject, documentId: attachId || undefined }) });
        const d = await r.json();
        if (d.ok) { setResult(attachId ? "✓ Sent with attachment." : "✓ Sent on WhatsApp."); setTimeout(onClose, 1000); }
        else setResult(`✗ ${d.error ?? "Send failed"}`);
      } catch { setResult("✗ Network error"); }
    } else {
      window.open(waLink(phone, text), "_blank", "noopener");
      setResult("Opened WhatsApp — press send there.");
    }
    setSending(false);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(20,19,16,0.35)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "10vh" }}>
      <div onClick={(e) => e.stopPropagation()} className="pop-in" style={{ width: "min(540px,94vw)", background: "var(--surface)", borderRadius: 16, boxShadow: "var(--shadow-lg)", border: "0.5px solid var(--border-2)", overflow: "hidden" }} role="dialog" aria-label="Draft with AI">
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--accent)" }}><Sparkles size={14} className="text-white" /></div>
            <div>
              <div className="text-sm font-semibold text-ink">Draft for {name}</div>
              <div className="text-[11px] text-ink-3">{phone ? phone : "no phone on file"} · {waReady ? "WhatsApp linked" : "will open wa.me"}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-3 hover:text-ink"><X size={17} /></button>
        </div>

        <div className="space-y-2.5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="What should this message say?" className="min-w-[200px] flex-1 rounded-lg border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }} />
            <select value={lang} onChange={(e) => setLang(e.target.value as "english" | "telugu")} className="rounded-lg border bg-surface px-2 py-1.5 text-xs outline-none" style={{ borderColor: "var(--border-2)" }}>
              <option value="english">English</option>
              <option value="telugu">Telugu</option>
            </select>
            <button onClick={draft} disabled={drafting} className="btn">{drafting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} {text ? "Redraft" : "Draft"}</button>
          </div>

          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={drafting ? "Writing…" : "Your message will appear here — edit freely before sending."} className="w-full rounded-xl border bg-surface px-3 py-2 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }} />

          {waReady && docs.length > 0 && (
            <div className="flex items-center gap-2">
              <Paperclip size={14} className="shrink-0 text-ink-3" />
              <select value={attachId} onChange={(e) => setAttachId(e.target.value)} className="flex-1 rounded-lg border bg-surface px-2 py-1.5 text-xs outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }}>
                <option value="">No attachment</option>
                {docs.map((d) => <option key={d.id} value={d.id}>{labelOf(DOC_TYPES, d.type)} · {d.fileName}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs" style={{ color: result?.startsWith("✓") ? "var(--emerald-700)" : result?.startsWith("✗") ? "var(--red-700)" : "var(--ink-3)" }}>{result}</span>
            <button onClick={send} disabled={!canSend || sending} className="btn btn-accent" style={{ opacity: canSend ? 1 : 0.5 }}>
              {sending ? <Loader2 size={14} className="animate-spin" /> : waReady ? <Send size={14} /> : <ExternalLink size={14} />}
              {waReady ? (attachId ? "Send with file" : "Send on WhatsApp") : "Open in WhatsApp"}
            </button>
          </div>
          {!phone && <p className="text-[11px]" style={{ color: "var(--amber-700)" }}>No phone number on file for {name} — add one to send.</p>}
        </div>
      </div>
    </div>
  );
}
