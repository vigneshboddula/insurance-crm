"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ChevronDown, CheckCircle2 } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import type { Leakage } from "@/lib/book-health";

/** Renewal leakage — the money currently walking out: overdue + lapsed policies
 *  with the exact names, so each one can be chased or written off consciously. */
export function LeakagePanel({ leak }: { leak: Leakage }) {
  const [open, setOpen] = useState(leak.count > 0 && leak.count <= 15);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5 pb-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <AlertTriangle size={15} style={{ color: leak.count ? "var(--red)" : "var(--emerald)" }} /> Renewal leakage
        </h2>
        <span className="text-[11px] text-ink-3">
          renewed this month: <b className="tnum" style={{ color: "var(--emerald-700)" }}>{leak.renewedThisMonth}</b> · {inr(leak.renewedPremiumThisMonth)}
        </span>
      </div>

      {leak.count === 0 ? (
        <p className="flex items-center gap-2 px-4 pb-4 text-sm" style={{ color: "var(--emerald-700)" }}><CheckCircle2 size={15} /> Nothing leaking — no overdue or lapsed policies. 🎯</p>
      ) : (
        <>
          <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 pb-3 text-left">
            <span className="text-xl font-semibold tnum" style={{ color: "var(--red)" }}>{inr(leak.premiumAtRisk)}</span>
            <span className="text-sm text-ink-2">at risk across <b>{leak.count}</b> {leak.count > 1 ? "policies" : "policy"} (overdue / lapsed)</span>
            <ChevronDown size={15} className={`ml-auto text-ink-3 transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <ul className="divide-y border-t px-2 pb-2" style={{ borderColor: "var(--border)" }}>
              {leak.rows.map((r) => (
                <li key={r.policyId}>
                  <Link href={`/clients/${r.clientId}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{r.name} <span className="font-normal text-ink-3">· {r.carrier}</span></div>
                      <div className="truncate text-[11px] text-ink-3 tnum">{r.policyNumber} · due {fmtDate(r.renewalDate)}</div>
                    </div>
                    <span className="tnum text-sm font-medium text-ink">{inr(r.premium)}</span>
                    <span className={`pill pill-${r.status === "lapsed" ? "gray" : "red"} w-[92px] justify-center`}>{r.status === "lapsed" ? "Lapsed" : `${r.daysOverdue}d overdue`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
