"use client";

import Link from "next/link";
import { useState } from "react";
import { FileWarning, ChevronDown } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";

type Row = { id: string; clientId: string; name: string; carrier: string; policyNumber: string; premium: number; renewalDate: string; days: number };

/** Reminder: policies due within a month whose renewal notice hasn't been
 *  uploaded. A renewal notice ≈ a certain renewal, so a missing one is a gap. */
export function MissingNotices({ rows }: { rows: Row[] }) {
  const [open, setOpen] = useState(true);
  if (!rows.length) return null;

  return (
    <section className="card overflow-hidden" style={{ borderColor: "var(--amber)" }}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-5 py-3 text-left">
        <FileWarning size={16} style={{ color: "var(--amber-700)" }} />
        <span className="text-sm font-semibold text-ink">Renewal notice not uploaded — {rows.length} {rows.length > 1 ? "policies" : "policy"} due soon</span>
        <span className="ml-auto text-[11px] text-ink-3">Upload each notice under “Upload renewal notices” above</span>
        <ChevronDown size={15} className={open ? "rotate-180 text-ink-3 transition" : "text-ink-3 transition"} />
      </button>
      {open && (
        <ul className="divide-y px-2 pb-2" style={{ borderColor: "var(--border)" }}>
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/clients/${r.clientId}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{r.name} <span className="font-normal text-ink-3">· {r.carrier}</span></div>
                  <div className="truncate text-[11px] text-ink-3 tnum">{r.policyNumber} · {inr(r.premium)}</div>
                </div>
                <span className={`pill pill-${r.days <= 7 ? "amber" : "gray"}`}>{r.days === 0 ? "Due today" : `${r.days}d · ${fmtDate(r.renewalDate)}`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
