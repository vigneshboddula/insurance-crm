"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, Zap, Sparkles, AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { labelOf, LINES } from "@/lib/enums";
import { AiDraftButton } from "@/components/ai/AiDraftButton";
import { markRenewed } from "@/app/renewals/actions";

type Row = { id: string; clientId: string; name: string; phone: string | null; members: string; product: string; carrier: string; line: string; premium: number; policyNumber: string; renewalDate: string; days: number; status: string };
type Summary = { count7: number; premium7: number; lapsedCount: number; lapsedPremium: number };

const CATS = [
  { key: "immediate", label: "Immediate Renewals", sub: "Due in the next 7 days", icon: Zap, tone: "var(--amber-700)" },
  { key: "recommended", label: "Recommended for you", sub: "High-value, due this month", icon: Sparkles, tone: "var(--accent-700)" },
  { key: "lapsed", label: "Lapsed Policies", sub: "Renewal expired", icon: AlertTriangle, tone: "var(--red-700)" },
  { key: "recentlyRenewed", label: "Recently Renewed", sub: "Last 90 days", icon: CheckCircle2, tone: "var(--emerald-700)" },
] as const;

type CatKey = (typeof CATS)[number]["key"];

export function RenewalsHub({ immediate, recommended, lapsed, recentlyRenewed, summary }: { immediate: Row[]; recommended: Row[]; lapsed: Row[]; recentlyRenewed: Row[]; summary: Summary }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [cat, setCat] = useState<CatKey>("immediate");
  const [q, setQ] = useState("");
  const [lob, setLob] = useState("");
  const [sort, setSort] = useState<"due" | "premium">("due");
  const [aiOk, setAiOk] = useState(false);

  useEffect(() => {
    fetch("/api/ai/status").then((r) => r.json()).then((d) => setAiOk(!!d.available)).catch(() => {});
  }, []);

  const data: Record<CatKey, Row[]> = { immediate, recommended, lapsed, recentlyRenewed };
  const counts: Record<CatKey, number> = { immediate: immediate.length, recommended: recommended.length, lapsed: lapsed.length, recentlyRenewed: recentlyRenewed.length };

  const rows = useMemo(() => {
    let r = data[cat];
    const t = q.trim().toLowerCase();
    if (t) r = r.filter((x) => [x.name, x.policyNumber, x.carrier, x.product].some((f) => f.toLowerCase().includes(t)));
    if (lob) r = r.filter((x) => x.line === lob);
    r = [...r].sort((a, b) => (sort === "premium" ? b.premium - a.premium : a.days - b.days));
    return r;
  }, [cat, q, lob, sort, immediate, recommended, lapsed, recentlyRenewed]);

  const renew = (id: string) => start(async () => { await markRenewed(id); router.refresh(); });

  const StatusCell = ({ r }: { r: Row }) => {
    if (r.status === "renewed") return <span className="text-xs font-medium" style={{ color: "var(--emerald-700)" }}>Renewed on {fmtDate(r.renewalDate)}</span>;
    if (r.days < 0) return <div><div className="text-xs font-medium" style={{ color: "var(--red-700)" }}>Renewal expired {Math.abs(r.days)} day{Math.abs(r.days) > 1 ? "s" : ""} ago</div><div className="text-[11px] text-ink-4 tnum">{fmtDate(r.renewalDate)}</div></div>;
    return <div><div className="text-xs font-medium" style={{ color: r.days <= 7 ? "var(--amber-700)" : "var(--ink-2)" }}>Renewal due in {r.days === 0 ? "today" : `${r.days} day${r.days > 1 ? "s" : ""}`}</div><div className="text-[11px] text-ink-4 tnum">{fmtDate(r.renewalDate)}</div></div>;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Renewals</h1>
        <p className="text-xs text-ink-3">Your renewal book — act before they lapse.</p>
      </div>

      {/* summary banner */}
      <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between" style={{ background: "linear-gradient(90deg, var(--accent-50), var(--surface))", borderColor: "transparent" }}>
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "var(--accent)" }}><Bell size={20} className="text-white" /></div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-3">Your renewals · next 7 days</div>
            <div className="text-2xl font-semibold tnum text-ink">{summary.count7} Policies <span className="text-base font-normal text-ink-3">· {inr(summary.premium7)} premium</span></div>
          </div>
        </div>
        {summary.lapsedCount > 0 && (
          <div className="rounded-xl px-4 py-2 text-center" style={{ background: "var(--red-50)" }}>
            <div className="text-lg font-semibold tnum" style={{ color: "var(--red-700)" }}>{summary.lapsedCount}</div>
            <div className="text-[11px]" style={{ color: "var(--red-700)" }}>lapsed · {inr(summary.lapsedPremium)}</div>
          </div>
        )}
      </section>

      {/* category cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CATS.map((c) => {
          const active = cat === c.key;
          return (
            <button key={c.key} onClick={() => setCat(c.key)} className="card card-hover flex items-center justify-between p-3.5 text-left" style={active ? { borderColor: c.tone, boxShadow: "var(--shadow)" } : {}}>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5"><c.icon size={14} style={{ color: c.tone }} /><span className="text-2xl font-semibold tnum text-ink">{counts[c.key]}</span></div>
                <div className="mt-0.5 truncate text-[12px] font-medium text-ink">{c.label}</div>
                <div className="truncate text-[10px] text-ink-3">{c.sub}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* filter bar */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by customer name or policy number…" className="w-full rounded-xl border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }} />
        </div>
        <select value={lob} onChange={(e) => setLob(e.target.value)} className="rounded-xl border bg-surface px-3 py-2.5 text-sm outline-none sm:w-40" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }}>
          <option value="">All lines</option>
          {LINES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as "due" | "premium")} className="rounded-xl border bg-surface px-3 py-2.5 text-sm outline-none sm:w-40" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }}>
          <option value="due">Sort: Due date</option>
          <option value="premium">Sort: Premium high→low</option>
        </select>
      </div>

      {/* list */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <h2 className="text-[13px] font-semibold text-ink">{CATS.find((c) => c.key === cat)!.label} <span className="text-ink-4">({rows.length})</span></h2>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center"><Bell size={26} className="text-ink-4" /><p className="mt-2 text-sm text-ink-3">Nothing here right now.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-ink-3" style={{ background: "var(--surface-2)" }}>
                  <th className="px-4 py-2 text-left font-semibold">Customer Details</th>
                  <th className="px-3 py-2 text-left font-semibold">Product & Plan</th>
                  <th className="px-3 py-2 text-right font-semibold">Premium</th>
                  <th className="px-3 py-2 text-left font-semibold">Status & Expiry</th>
                  <th className="px-4 py-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-4 py-3">
                      <Link href={`/clients/${r.clientId}`} className="text-sm font-medium text-ink hover:underline">{r.name}</Link>
                      <div className="text-[11px] text-ink-3">{r.members && `${r.members} · `}<span className="tnum">{r.policyNumber}</span></div>
                    </td>
                    <td className="px-3 py-3"><div className="text-sm text-ink-2">{r.product}</div><div className="text-[11px] text-ink-4">{labelOf(LINES, r.line)}</div></td>
                    <td className="px-3 py-3 text-right tnum font-medium text-ink">{inr(r.premium)}</td>
                    <td className="px-3 py-3"><StatusCell r={r} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {r.status !== "renewed" && (
                          aiOk ? (
                            <AiDraftButton clientId={r.clientId} name={r.name} phone={r.phone} available={aiOk} subject="Renewal reminder" danger label="Send Payment Link" purpose={`a warm renewal reminder for their ${r.carrier} ${labelOf(LINES, r.line)} policy (no. ${r.policyNumber}, premium ${inr(r.premium)}) that is ${r.days < 0 ? "overdue — please renew to avoid a break in cover" : "due for renewal"}; include that you'll share the payment link to renew. Keep it short.`} />
                          ) : (
                            <a href={`https://wa.me/${(r.phone ?? "").replace(/\D/g, "")}`} target="_blank" rel="noopener" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--red)" }}>Send Payment Link</a>
                          )
                        )}
                        <Link href={`/clients/${r.clientId}`} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ background: "var(--red-50)", color: "var(--red-700)" }}>View</Link>
                        {r.status !== "renewed" && <button onClick={() => renew(r.id)} title="Mark renewed" className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-2"><CheckCircle2 size={15} style={{ color: "var(--emerald-700)" }} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
