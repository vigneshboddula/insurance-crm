"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText, Upload } from "lucide-react";
import { inr, fmtDate, daysUntil } from "@/lib/format";
import { labelOf, LINES, POLICY_STATUS } from "@/lib/enums";
import { PoliciesAddDialog } from "./PoliciesAddDialog";
import { BulkUpload } from "@/components/policies/BulkUpload";

type Policy = { id: string; clientId: string; clientName: string; line: string; carrier: string; policyNumber: string; planName: string | null; premium: number; sumAssured: number; renewalDate: string; startDate: string; status: string };

const RECENT_DAYS = 30;

export function PoliciesView({ policies, clients }: { policies: Policy[]; clients: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"recent" | "all">("recent");
  const [showBulk, setShowBulk] = useState(false);

  const recentCutoff = Date.now() - RECENT_DAYS * 86_400_000;
  const base = useMemo(() => (view === "recent" ? policies.filter((p) => new Date(p.startDate).getTime() >= recentCutoff) : policies), [view, policies, recentCutoff]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return base;
    return base.filter((p) => [p.clientName, p.carrier, p.policyNumber, p.line, p.planName].some((f) => f?.toLowerCase().includes(t)));
  }, [q, base]);

  const recentCount = policies.filter((p) => new Date(p.startDate).getTime() >= recentCutoff).length;
  const totalPremium = base.filter((p) => p.status === "active").reduce((s, p) => s + p.premium, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Policies · Recently Issued</h1>
          <p className="text-xs text-ink-3">{view === "recent" ? `${recentCount} issued in the last ${RECENT_DAYS} days` : `${policies.length} policies`} · {inr(totalPremium)} premium</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface-3)" }}>
            <button onClick={() => setView("recent")} className="rounded-md px-2.5 py-1 text-xs font-medium transition" style={view === "recent" ? { background: "var(--surface)", color: "var(--ink)" } : { color: "var(--ink-3)" }}>Recently issued</button>
            <button onClick={() => setView("all")} className="rounded-md px-2.5 py-1 text-xs font-medium transition" style={view === "all" ? { background: "var(--surface)", color: "var(--ink)" } : { color: "var(--ink-3)" }}>All</button>
          </div>
          <button onClick={() => setShowBulk((v) => !v)} className="btn"><Upload size={15} /> Bulk upload</button>
          <PoliciesAddDialog clients={clients} />
        </div>
      </div>

      {showBulk && <BulkUpload mode="policies" />}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by client, carrier, policy number…" className="w-full rounded-xl border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }} />
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <FileText size={28} className="text-ink-4" />
          <p className="mt-2 text-sm font-medium text-ink">{q ? "No policies match." : "No policies yet."}</p>
          <p className="text-xs text-ink-3">Open a client and use “Add policy”.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {filtered.map((p) => {
              const d = daysUntil(p.renewalDate);
              const tone = p.status !== "active" ? "gray" : d < 0 ? "red" : d <= 14 ? "amber" : "green";
              return (
                <li key={p.id}>
                  <Link href={`/clients/${p.clientId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className="pill pill-accent w-16 justify-center">{labelOf(LINES, p.line)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{p.clientName} <span className="font-normal text-ink-3">· {p.carrier}</span></div>
                      <div className="truncate text-[11px] text-ink-3 tnum">{p.policyNumber}{p.planName ? ` · ${p.planName}` : ""} · SA {inr(p.sumAssured)}</div>
                    </div>
                    <span className="hidden text-sm text-ink-2 tnum sm:block">{inr(p.premium)}</span>
                    <span className={`pill pill-${tone} w-[110px] justify-center`}>{p.status === "active" ? (d < 0 ? `Overdue ${Math.abs(d)}d` : fmtDate(p.renewalDate)) : labelOf(POLICY_STATUS, p.status)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
