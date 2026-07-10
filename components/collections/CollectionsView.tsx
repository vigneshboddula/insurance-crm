"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Search, CheckCircle2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, SubmitButton } from "@/components/ui/form";
import { inr, fmtDate, daysUntil } from "@/lib/format";
import { labelOf, LINES, PAYMENT_MODE, COLLECTION_STATUS } from "@/lib/enums";
import { recordCollection } from "@/app/collections/actions";

type Row = { policyId: string; clientId: string; clientName: string; phone: string | null; policyLabel: string; line: string; amount: number; cycleDate: string; collected: number; status: string; mode: string | null };
const TONE: Record<string, string> = { pending: "amber", partial: "accent", collected: "green" };

export function CollectionsView({ rows, kpis }: { rows: Row[]; kpis: { expected: number; collected: number; pending: number } }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rec, setRec] = useState<Row | null>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? rows.filter((r) => [r.clientName, r.policyLabel, r.phone ?? ""].some((f) => f.toLowerCase().includes(t))) : rows;
    // outstanding first (pending/partial), by soonest due; then collected
    return [...base].sort((a, b) => {
      const ao = a.status === "collected" ? 1 : 0, bo = b.status === "collected" ? 1 : 0;
      if (ao !== bo) return ao - bo;
      return new Date(a.cycleDate).getTime() - new Date(b.cycleDate).getTime();
    });
  }, [q, rows]);

  const Kpi = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
    <div className="card p-4">
      <div className="text-[11px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tnum" style={{ color: tone }}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-ink"><Banknote size={18} style={{ color: "var(--emerald)" }} /> Collections</h1>
        <p className="text-xs text-ink-3">Premium collection ledger — money due vs collected across your book.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Expected" value={inr(kpis.expected)} />
        <Kpi label="Collected" value={inr(kpis.collected)} tone="var(--emerald-700)" />
        <Kpi label="Outstanding" value={inr(kpis.pending)} tone="var(--amber-700)" />
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by client, policy…" className="w-full rounded-xl border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }} />
      </div>

      <div className="card overflow-x-auto">
        {filtered.length === 0 ? <p className="py-10 text-center text-sm text-ink-3">Nothing to collect.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wide text-ink-3" style={{ borderColor: "var(--border)" }}>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Policy</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const d = daysUntil(r.cycleDate);
                return (
                  <tr key={`${r.policyId}|${r.cycleDate}`} className="border-b last:border-0 hover:bg-surface-2" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2.5"><a href={`/clients/${r.clientId}`} className="font-medium text-ink hover:text-accent">{r.clientName}</a></td>
                    <td className="px-4 py-2.5"><span className="pill pill-accent mr-1.5">{labelOf(LINES, r.line)}</span><span className="text-ink-3">{r.policyLabel}</span></td>
                    <td className="px-4 py-2.5 tnum" style={{ color: r.status !== "collected" && d < 0 ? "var(--red)" : "var(--ink-2)" }}>{fmtDate(r.cycleDate)}</td>
                    <td className="px-4 py-2.5 text-right tnum">{inr(r.amount)}{r.status === "partial" ? <span className="block text-[11px] text-ink-3">{inr(r.collected)} in</span> : null}</td>
                    <td className="px-4 py-2.5"><span className={`pill pill-${TONE[r.status] ?? "gray"}`}>{labelOf(COLLECTION_STATUS, r.status)}</span></td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setRec(r)} className="btn btn-sm">{r.status === "collected" ? "Edit" : "Record"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!rec} onClose={() => setRec(null)} title="Record collection" subtitle={rec ? `${rec.clientName} · ${inr(rec.amount)} due ${fmtDate(rec.cycleDate)}` : undefined}>
        {rec && (
          <form action={recordCollection} onSubmit={() => setTimeout(() => { setRec(null); router.refresh(); }, 50)} className="space-y-4">
            <input type="hidden" name="policyId" value={rec.policyId} />
            <input type="hidden" name="clientId" value={rec.clientId} />
            <input type="hidden" name="cycleDate" value={rec.cycleDate} />
            <input type="hidden" name="expectedAmount" value={rec.amount} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Amount collected (₹)" hint="Enter part amount for partial"><Input name="collectedAmount" inputMode="numeric" defaultValue={rec.collected || rec.amount} /></Field>
              <Field label="Mode"><Select name="mode" options={PAYMENT_MODE} defaultValue={rec.mode ?? "none"} /></Field>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="flex items-center gap-1 text-[11px] text-ink-3"><CheckCircle2 size={12} /> Full amount marks it collected.</span>
              <SubmitButton>Save</SubmitButton>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
