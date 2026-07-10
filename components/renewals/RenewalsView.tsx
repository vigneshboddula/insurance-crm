"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, MessageCircle, CheckCircle2 } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { labelOf, LINES } from "@/lib/enums";
import { waLink } from "@/lib/links";
import { AiDraftButton } from "@/components/ai/AiDraftButton";
import { markRenewed } from "@/app/renewals/actions";

type R = { id: string; clientId: string; name: string; phone: string; carrier: string; line: string; policyNumber: string; premium: number; renewalDate: string; days: number };

export function RenewalsView({ renewals }: { renewals: R[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [aiOk, setAiOk] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/ai/status").then((r) => r.json()).then((d) => { if (alive) setAiOk(!!d.available); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return renewals;
    return renewals.filter((r) => [r.name, r.carrier, r.policyNumber, r.line].some((f) => f.toLowerCase().includes(t)));
  }, [q, renewals]);

  const overdue = filtered.filter((r) => r.days < 0);
  const week = filtered.filter((r) => r.days >= 0 && r.days <= 7);
  const month = filtered.filter((r) => r.days > 7 && r.days <= 30);
  const later = filtered.filter((r) => r.days > 30);
  const atRisk = [...overdue, ...week].reduce((s, r) => s + r.premium, 0);

  const renew = (id: string) => start(async () => { await markRenewed(id); router.refresh(); });

  const Row = ({ r }: { r: R }) => {
    const tone = r.days < 0 ? { bg: "var(--red-50)", c: "var(--red-700)", label: `Overdue ${Math.abs(r.days)}d` } : r.days <= 14 ? { bg: "var(--amber-50)", c: "var(--amber-700)", label: r.days === 0 ? "Due today" : `In ${r.days}d` } : { bg: "var(--emerald-50)", c: "var(--emerald-700)", label: `In ${r.days}d` };
    return (
      <li className="flex items-center gap-3 px-4 py-2.5">
        <Link href={`/clients/${r.clientId}`} className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-ink hover:underline">{r.name}</div>
          <div className="truncate text-[11px] text-ink-3 tnum">{r.carrier} · {labelOf(LINES, r.line)} · {r.policyNumber}</div>
        </Link>
        <span className="hidden text-sm text-ink-2 tnum sm:block">{inr(r.premium)}</span>
        <span className="hidden text-xs text-ink-3 tnum md:block">{fmtDate(r.renewalDate)}</span>
        <span className="pill w-[84px] justify-center" style={{ background: tone.bg, color: tone.c }}>{tone.label}</span>
        <AiDraftButton
          clientId={r.clientId}
          name={r.name}
          phone={r.phone}
          available={aiOk}
          compact
          subject="Renewal reminder"
          purpose={`a warm, polite renewal reminder for their ${r.carrier} ${labelOf(LINES, r.line)} policy that is ${r.days < 0 ? "overdue" : "due soon"}; keep it short`}
        />
        <a href={waLink(r.phone, `Hi ${r.name}, your ${r.carrier} policy ${r.policyNumber} is due for renewal on ${fmtDate(r.renewalDate)} (premium ${inr(r.premium)}). Shall I help you renew it?`)} target="_blank" rel="noopener" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label="Send WhatsApp"><MessageCircle size={13} /></a>
        <button onClick={() => renew(r.id)} className="btn" title="Mark renewed"><CheckCircle2 size={14} style={{ color: "var(--emerald-700)" }} /> <span className="hidden sm:inline">Renewed</span></button>
      </li>
    );
  };

  const Group = ({ title, items, tone }: { title: string; items: R[]; tone?: string }) =>
    items.length === 0 ? null : (
      <section className="card overflow-hidden">
        <h2 className="px-4 pt-3.5 pb-1 text-[13px] font-semibold" style={{ color: tone ?? "var(--ink)" }}>{title} <span className="text-ink-4">({items.length})</span></h2>
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>{items.map((r) => <Row key={r.id} r={r} />)}</ul>
      </section>
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Renewals</h1>
        <p className="text-xs text-ink-3">{overdue.length} overdue · {week.length} this week · {month.length} this month</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3"><div className="text-[11px] uppercase tracking-wide text-ink-3">Overdue</div><div className="text-2xl font-semibold" style={{ color: overdue.length ? "var(--red)" : "var(--emerald)" }}>{overdue.length}</div></div>
        <div className="card p-3"><div className="text-[11px] uppercase tracking-wide text-ink-3">Due this week</div><div className="text-2xl font-semibold" style={{ color: week.length ? "var(--amber-700)" : "var(--emerald)" }}>{week.length}</div></div>
        <div className="card p-3"><div className="text-[11px] uppercase tracking-wide text-ink-3">Premium at risk</div><div className="text-2xl font-semibold tnum" style={{ color: "var(--red)" }}>{inr(atRisk)}</div></div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by holder, carrier, policy number…" className="w-full rounded-xl border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }} />
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center"><Bell size={28} className="text-ink-4" /><p className="mt-2 text-sm font-medium text-ink">No renewals match.</p></div>
      ) : (
        <>
          <Group title="Overdue" items={overdue} tone="var(--red-700)" />
          <Group title="Due this week" items={week} tone="var(--amber-700)" />
          <Group title="Due this month" items={month} />
          <Group title="Later" items={later} />
        </>
      )}
    </div>
  );
}
