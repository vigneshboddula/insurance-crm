"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Phone, AlertTriangle, PhoneOff, CheckCircle2, Send, ChevronDown } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import type { WorklistRow, WorklistSummary, EscalationStatus } from "@/lib/renewal-worklist";
import { createCallTask } from "@/app/renewals/actions";

const ESC_META: Record<EscalationStatus, { label: string; tone: string; bg: string }> = {
  not_contacted: { label: "Not contacted", tone: "var(--amber-700)", bg: "var(--amber-50)" },
  reminded:      { label: "Reminded", tone: "var(--accent-700)", bg: "var(--accent-50)" },
  no_reply:      { label: "No reply", tone: "var(--red-700)", bg: "var(--red-50)" },
  called:        { label: "Call scheduled", tone: "var(--ink-2)", bg: "var(--surface-3)" },
  at_risk:       { label: "At risk", tone: "var(--red-700)", bg: "var(--red-50)" },
  renewed:       { label: "Renewed", tone: "var(--emerald-700)", bg: "var(--emerald-50)" },
};

export function TodayWorklist({ rows, summary }: { rows: WorklistRow[]; summary: WorklistSummary }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [filter, setFilter] = useState<"all" | EscalationStatus>("all");
  const [open, setOpen] = useState(true);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.escalation === filter);

  const onCreateCall = (r: WorklistRow) => {
    start(async () => { await createCallTask(r.clientId, r.policyId, r.name, r.policyNumber); router.refresh(); });
  };

  const chip = (key: "all" | EscalationStatus, label: string, count: number) => (
    <button key={key} onClick={() => setFilter(key)} className="rounded-lg px-2 py-1 text-[11px] font-medium transition whitespace-nowrap"
      style={filter === key ? { background: "var(--accent-50)", color: "var(--accent-700)" } : { background: "var(--surface-3)", color: "var(--ink-3)" }}>
      {label} ({count})
    </button>
  );

  if (rows.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 pt-3.5 pb-2 text-left">
        <Clock size={16} style={{ color: "var(--accent)" }} />
        <div className="flex-1">
          <h2 className="text-[13px] font-semibold text-ink">Today&apos;s renewal worklist</h2>
          <p className="text-[11px] text-ink-3">{summary.total} policies · {inr(summary.premiumAtStake)} premium at stake</p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          {summary.notContacted > 0 && <span style={{ color: "var(--amber-700)" }}>{summary.notContacted} not contacted</span>}
          {summary.noReply > 0 && <span style={{ color: "var(--red-700)" }}>{summary.noReply} no reply</span>}
          {summary.atRisk > 0 && <span className="font-semibold" style={{ color: "var(--red-700)" }}>{summary.atRisk} at risk</span>}
          {summary.deadNumbers > 0 && <span style={{ color: "var(--red-700)" }}><PhoneOff size={11} className="mr-0.5 inline" />{summary.deadNumbers}</span>}
        </div>
        <ChevronDown size={15} className={`text-ink-3 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {chip("all", "All", rows.length)}
            {chip("not_contacted", "Not contacted", summary.notContacted)}
            {chip("reminded", "Reminded", rows.filter((r) => r.escalation === "reminded").length)}
            {chip("no_reply", "No reply", summary.noReply)}
            {chip("called", "Call scheduled", rows.filter((r) => r.escalation === "called").length)}
            {chip("at_risk", "At risk", summary.atRisk)}
          </div>

          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {filtered.map((r) => {
              const esc = ESC_META[r.escalation];
              const overdue = r.daysUntilDue < 0;
              return (
                <li key={r.policyId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/clients/${r.clientId}`} className="truncate text-sm font-medium text-ink hover:underline">{r.name}</Link>
                      {r.deadNumber && <span title="Recent sends failed — number may be dead" className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--red-50)", color: "var(--red-700)" }}><PhoneOff size={10} /> Dead?</span>}
                    </div>
                    <div className="truncate text-[11px] text-ink-3 tnum">{r.carrier} · {r.policyNumber} · {r.planName}</div>
                  </div>

                  <span className="hidden text-sm font-medium text-ink tnum sm:block">{inr(r.premium)}</span>

                  <span className="text-[11px] font-medium tnum w-[90px] text-center" style={{ color: overdue ? "var(--red-700)" : "var(--ink-2)" }}>
                    {overdue ? `${Math.abs(r.daysUntilDue)}d overdue` : r.daysUntilDue === 0 ? "Today" : `${r.daysUntilDue}d left`}
                  </span>

                  <span className="rounded-lg px-2 py-1 text-[11px] font-medium w-[110px] text-center" style={{ background: esc.bg, color: esc.tone }}>{esc.label}</span>

                  <div className="flex items-center gap-1">
                    {r.phone && r.escalation !== "called" && r.escalation !== "at_risk" && (
                      <a href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener" title="WhatsApp" className="rounded-lg p-1.5 hover:bg-surface-3">
                        <Send size={14} style={{ color: "var(--emerald)" }} />
                      </a>
                    )}
                    {(r.escalation === "no_reply" || r.escalation === "at_risk") && !r.hasCallTask && (
                      <button onClick={() => onCreateCall(r)} title="Create call task" className="rounded-lg p-1.5 hover:bg-surface-3">
                        <Phone size={14} style={{ color: "var(--accent)" }} />
                      </button>
                    )}
                    {r.escalation === "at_risk" && (
                      <AlertTriangle size={14} style={{ color: "var(--red)" }} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {filtered.length === 0 && (
            <div className="flex items-center justify-center py-8 text-sm text-ink-3">
              <CheckCircle2 size={15} className="mr-2" style={{ color: "var(--emerald)" }} /> Nothing in this filter.
            </div>
          )}
        </>
      )}
    </section>
  );
}
