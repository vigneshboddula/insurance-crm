"use client";

import { useState, useTransition } from "react";
import { Send, X, CheckCircle2, Sparkles } from "lucide-react";
import { sendApproval, dismissApproval, sendAllApprovals } from "@/app/outbox/actions";

type Item = { id: string; category: string; title: string; message: string; clientId: string | null; phone: string | null; createdAt: string };

const LABEL: Record<string, string> = {
  quote: "Quote follow-up", winback: "Win-back", claim: "Claim update",
  thankyou: "Thank-you", anniversary: "Anniversary", selfservice: "Self-service",
};

export function ApprovalsPanel({ items }: { items: Item[] }) {
  const [rows, setRows] = useState(items);
  const [busy, startBusy] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  if (!rows.length) return null;

  function drop(id: string) { setRows((r) => r.filter((x) => x.id !== id)); }

  function onSend(id: string) {
    startBusy(async () => {
      const res = await sendApproval(id);
      if (res.ok) { drop(id); setNote(null); } else setNote(res.error ?? "Send failed");
    });
  }
  function onDismiss(id: string) {
    startBusy(async () => { await dismissApproval(id); drop(id); });
  }
  function onSendAll() {
    startBusy(async () => {
      const r = await sendAllApprovals();
      setNote(`Sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ""}.`);
      if (r.sent) setRows([]);
    });
  }

  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles size={15} style={{ color: "var(--accent)" }} /> Approvals
          <span className="rounded-full px-1.5 py-0.5 text-[11px] font-medium" style={{ background: "var(--accent-50)", color: "var(--accent-700)" }}>{rows.length}</span>
        </h2>
        <button onClick={onSendAll} disabled={busy} className="btn btn-accent btn-sm"><Send size={13} /> Send all</button>
      </div>
      <p className="mb-2 text-[11px] text-ink-3">Messages the engine prepared for you. Review and send with one tap, or dismiss.</p>

      {note && (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}>
          <CheckCircle2 size={13} /> {note}
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl p-3" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-medium text-ink">
                <span className="rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: "var(--surface-3)", color: "var(--ink-3)" }}>{LABEL[r.category] ?? r.category}</span>
                {r.title}
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => onSend(r.id)} disabled={busy} className="btn btn-accent btn-sm"><Send size={12} /> Send</button>
                <button onClick={() => onDismiss(r.id)} disabled={busy} className="btn btn-sm" aria-label="Dismiss"><X size={12} /></button>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-ink-2">{r.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
