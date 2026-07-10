"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, MessageCircle, Phone, Mail, Smartphone, Users2, StickyNote, Trash2, ArrowUpRight, ArrowDownLeft, MessagesSquare } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea, SubmitButton } from "@/components/ui/form";
import { labelOf, COMM_CHANNELS, COMM_DIRECTIONS } from "@/lib/enums";
import { logCommunication, deleteCommunication, restoreCommunication } from "@/app/communications/actions";
import { useToast } from "@/components/ui/Toast";

type Comm = { id: string; clientId: string; clientName: string; channel: string; direction: string; subject: string | null; body: string | null; status: string | null; occurredAt: string };

const ICON: Record<string, React.ElementType> = { whatsapp: MessageCircle, call: Phone, email: Mail, sms: Smartphone, meeting: Users2, note: StickyNote };
const TONE: Record<string, string> = { whatsapp: "var(--emerald)", call: "var(--accent)", email: "var(--amber-700)", sms: "var(--accent)", meeting: "var(--ink-2)", note: "var(--ink-3)" };

function dayLabel(iso: string) {
  const d = new Date(iso); const t = new Date(); const y = new Date(Date.now() - 86400000);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: d.getFullYear() === t.getFullYear() ? undefined : "numeric" });
}

export function CommLog({ comms, clients }: { comms: Comm[]; clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return comms.filter((c) =>
      (!channel || c.channel === channel) &&
      (!t || [c.clientName, c.subject ?? "", c.body ?? ""].some((f) => f.toLowerCase().includes(t)))
    );
  }, [q, channel, comms]);

  const groups = useMemo(() => {
    const m = new Map<string, Comm[]>();
    for (const c of filtered) { const k = dayLabel(c.occurredAt); (m.get(k) ?? m.set(k, []).get(k)!).push(c); }
    return [...m.entries()];
  }, [filtered]);

  const { toast } = useToast();
  const remove = (c: Comm) =>
    start(async () => {
      const snap = await deleteCommunication(c.id);
      router.refresh();
      if (snap) toast("Log entry deleted", { undo: async () => { await restoreCommunication(snap); router.refresh(); } });
    });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => { await logCommunication(fd); setAdding(false); router.refresh(); });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Communication log</h1>
          <p className="text-xs text-ink-3">{comms.length} interaction{comms.length !== 1 ? "s" : ""} across all clients</p>
        </div>
        <button onClick={() => setAdding(true)} className="btn btn-accent"><Plus size={15} /> Log communication</button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by client, subject, message…" className="w-full rounded-xl border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }} />
        </div>
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-xl border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent sm:w-44" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }}>
          <option value="">All channels</option>
          {COMM_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <MessagesSquare size={28} className="text-ink-4" />
          <p className="mt-2 text-sm font-medium text-ink">No communications {comms.length ? "match." : "logged yet."}</p>
          {!comms.length && <button onClick={() => setAdding(true)} className="btn btn-accent mt-3"><Plus size={15} /> Log your first one</button>}
        </div>
      ) : (
        groups.map(([day, items]) => (
          <section key={day} className="card overflow-hidden">
            <h2 className="px-4 pt-3.5 pb-1 text-[13px] font-semibold text-ink">{day} <span className="text-ink-4">({items.length})</span></h2>
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {items.map((c) => {
                const Icon = ICON[c.channel] ?? StickyNote;
                return (
                  <li key={c.id} className="group flex items-start gap-3 px-4 py-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--surface-3)" }}><Icon size={14} style={{ color: TONE[c.channel] ?? "var(--ink-3)" }} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/clients/${c.clientId}`} className="truncate text-sm font-medium text-ink hover:underline">{c.clientName}</Link>
                        {c.direction === "inbound" ? <ArrowDownLeft size={12} className="text-ink-4" /> : <ArrowUpRight size={12} className="text-ink-4" />}
                        <span className="pill-gray pill">{labelOf(COMM_CHANNELS, c.channel)}</span>
                        {c.status === "failed" && <span className="pill" style={{ background: "var(--red-50)", color: "var(--red-700)" }}>failed</span>}
                      </div>
                      {(c.subject || c.body) && <div className="truncate text-[12px] text-ink-3">{c.subject ? <b className="font-medium text-ink-2">{c.subject}: </b> : ""}{c.body}</div>}
                    </div>
                    <span className="shrink-0 text-[11px] text-ink-4 tnum">{new Date(c.occurredAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                    <button onClick={() => remove(c)} className="shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100" aria-label="Delete"><Trash2 size={13} style={{ color: "var(--red)" }} /></button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <Dialog open={adding} onClose={() => setAdding(false)} title="Log a communication">
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Client" required><Select name="clientId" required options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose a client" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Channel"><Select name="channel" options={COMM_CHANNELS} defaultValue="call" /></Field>
            <Field label="Direction"><Select name="direction" options={COMM_DIRECTIONS} defaultValue="outbound" /></Field>
            <Field label="When"><Input name="occurredAt" type="datetime-local" defaultValue={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} /></Field>
            <Field label="Subject"><Input name="subject" placeholder="Renewal call" /></Field>
          </div>
          <Field label="Notes"><Textarea name="body" rows={3} placeholder="What was discussed…" /></Field>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setAdding(false)} className="btn">Cancel</button>
            <SubmitButton>Save</SubmitButton>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
