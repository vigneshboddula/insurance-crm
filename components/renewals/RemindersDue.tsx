"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Send, Loader2, ChevronDown, Check, X, ShieldAlert } from "lucide-react";
import { inr } from "@/lib/format";
import { sendReminderNow, skipReminder, sendAllDueReminders } from "@/app/renewals/reminder-actions";

type Due = {
  policyId: string; clientId: string; name: string; phone: string | null;
  carrier: string; policyNumber: string; premium: number; cycleDate: string;
  step: string; stepLabel: string; grace: boolean; daysFromDue: number; message: string;
  noticeDocId?: string | null;
};

export function RemindersDue({ due }: { due: Due[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [waReady, setWaReady] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/whatsapp/status").then((r) => r.json()).then((d) => setWaReady(d.status === "ready")).catch(() => {});
  }, []);

  if (!due.length) return null;

  const msgOf = (d: Due) => msgs[d.policyId + d.step] ?? d.message;

  const sendOne = (d: Due) => {
    setBusy(d.policyId + d.step); setNote(null);
    start(async () => {
      const res = await sendReminderNow({ policyId: d.policyId, clientId: d.clientId, step: d.step as never, cycleDate: d.cycleDate, message: msgOf(d), phone: d.phone, noticeDocId: d.noticeDocId });
      setBusy(null);
      if (res.ok) router.refresh(); else setNote(`✗ ${res.error ?? "Send failed"}`);
    });
  };
  const skip = (d: Due) => start(async () => { await skipReminder({ policyId: d.policyId, clientId: d.clientId, step: d.step as never, cycleDate: d.cycleDate, message: "", phone: d.phone }); router.refresh(); });
  const sendAll = () => {
    if (!waReady) { setNote("Connect WhatsApp first to send in bulk."); return; }
    setBulk(true); setNote(null);
    start(async () => { const r = await sendAllDueReminders(); setBulk(false); setNote(`Sent ${r.sent} of ${r.total}${r.failed ? ` · ${r.failed} failed` : ""}.`); router.refresh(); });
  };

  return (
    <section className="card overflow-hidden" style={{ borderColor: "var(--accent-100)" }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--accent-50)" }}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink"><BellRing size={15} style={{ color: "var(--accent-700)" }} /> Reminders due <span className="text-ink-3">({due.length})</span></h2>
        <div className="flex items-center gap-2">
          {note && <span className="text-[11px] text-ink-3">{note}</span>}
          <button onClick={sendAll} disabled={bulk || !waReady} className="btn btn-accent" style={{ opacity: waReady ? 1 : 0.5 }} title={waReady ? "Send all due reminders on WhatsApp" : "Connect WhatsApp to send"}>
            {bulk ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send all
          </button>
        </div>
      </div>
      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {due.map((d) => {
          const k = d.policyId + d.step;
          const isOpen = open === k;
          return (
            <li key={k} className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{d.name}</span>
                    <span className="pill" style={d.grace ? { background: "var(--red-50)", color: "var(--red-700)" } : { background: "var(--accent-50)", color: "var(--accent-700)" }}>
                      {d.grace && <ShieldAlert size={10} className="mr-0.5 inline" />}{d.stepLabel}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-ink-3 tnum">{d.carrier} · {d.policyNumber} · {inr(d.premium)} · {d.daysFromDue < 0 ? `in ${-d.daysFromDue}d` : d.daysFromDue === 0 ? "today" : `${d.daysFromDue}d overdue`}</div>
                </div>
                <button onClick={() => setOpen(isOpen ? null : k)} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] text-ink-2 hover:bg-surface-2"><ChevronDown size={13} className={isOpen ? "rotate-180" : ""} /> Preview</button>
                <button onClick={() => skip(d)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-2" title="Mark handled (don't send)"><X size={14} className="text-ink-3" /></button>
                <button onClick={() => sendOne(d)} disabled={busy === k || !waReady || !d.phone} className="btn btn-accent" style={{ opacity: waReady && d.phone ? 1 : 0.5 }} title={!d.phone ? "No phone on file" : !waReady ? "Connect WhatsApp first" : "Send on WhatsApp"}>
                  {busy === k ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send
                </button>
              </div>
              {isOpen && (
                <textarea value={msgOf(d)} onChange={(e) => setMsgs((m) => ({ ...m, [k]: e.target.value }))} rows={4} className="mt-2 w-full rounded-xl border bg-surface px-3 py-2 text-xs outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }} />
              )}
            </li>
          );
        })}
      </ul>
      {!waReady && <div className="flex items-center gap-1.5 px-4 py-2 text-[11px]" style={{ background: "var(--amber-50)", color: "var(--amber-700)" }}><ShieldAlert size={12} /> Connect WhatsApp (on the WhatsApp page) to send these.</div>}
    </section>
  );
}
