"use client";

import { useState } from "react";
import Link from "next/link";
import { Stethoscope, AlertTriangle, Clock, CheckCircle2, XCircle, ChevronDown, Search } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import type { ClaimRow, ClaimSummary } from "@/lib/service";

type FilterKey = "all" | "intimated" | "in_progress" | "settled" | "overdue";

export function ClaimsPanel({ rows, summary }: { rows: ClaimRow[]; summary: ClaimSummary }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const filtered = rows.filter((r) => {
    if (filter === "intimated" && r.status !== "intimated") return false;
    if (filter === "in_progress" && ["intimated", "settled", "rejected", "paid"].includes(r.status)) return false;
    if (filter === "settled" && !["settled", "paid"].includes(r.status)) return false;
    if (filter === "overdue" && r.tatAlert !== "overdue") return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.clientName.toLowerCase().includes(q) && !r.policyNumber.toLowerCase().includes(q) && !(r.claimNumber ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: summary.total },
    { key: "intimated", label: "Intimated", count: summary.intimated },
    { key: "in_progress", label: "In progress", count: summary.inProgress },
    { key: "settled", label: "Settled", count: summary.settled },
    { key: "overdue", label: "TAT overdue", count: summary.overdueCount },
  ];

  const statusIcon = (status: string) => {
    if (["settled", "paid"].includes(status)) return <CheckCircle2 size={13} style={{ color: "var(--emerald-700)" }} />;
    if (status === "rejected") return <XCircle size={13} style={{ color: "var(--red)" }} />;
    return <Clock size={13} className="text-ink-3" />;
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5 pb-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Stethoscope size={15} className="text-ink-3" /> Claims tracker
        </h2>
        <span className="text-[11px] text-ink-3">{summary.total} claims · {inr(summary.totalAmount)}</span>
        {summary.overdueCount > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--red)" }}>
            <AlertTriangle size={12} /> {summary.overdueCount} TAT overdue
          </span>
        )}
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-4 gap-3 px-4 pb-3">
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-xl font-semibold tnum text-ink">{summary.intimated}</div>
          <div className="text-[11px] text-ink-3">Intimated</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-xl font-semibold tnum" style={{ color: "var(--amber-700)" }}>{summary.inProgress}</div>
          <div className="text-[11px] text-ink-3">In progress</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-xl font-semibold tnum" style={{ color: "var(--emerald-700)" }}>{summary.settled}</div>
          <div className="text-[11px] text-ink-3">Settled</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-xl font-semibold tnum" style={{ color: "var(--red)" }}>{summary.overdueCount}</div>
          <div className="text-[11px] text-ink-3">TAT overdue</div>
        </div>
      </div>

      {summary.total === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink-3">No claims logged yet. Claims will appear here when you log them from a client's profile.</p>
      ) : (
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, policy, claim #…" className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
            </div>
            {chips.map((c) => (
              <button key={c.key} onClick={() => setFilter(c.key)} className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${filter === c.key ? "bg-indigo-600 text-white" : "text-ink-2 hover:bg-surface-3"}`}>
                {c.label} <span className="tnum">{c.count}</span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] text-ink-3" style={{ borderColor: "var(--border)" }}>
                  <th className="pb-1.5 text-left font-medium">Client</th>
                  <th className="pb-1.5 text-left font-medium">Policy</th>
                  <th className="pb-1.5 text-left font-medium">Reason</th>
                  <th className="pb-1.5 text-right font-medium">Amount</th>
                  <th className="pb-1.5 text-center font-medium">Status</th>
                  <th className="pb-1.5 text-right font-medium">Age</th>
                  <th className="pb-1.5 text-center font-medium">TAT</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-surface-2 transition" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 pr-3">
                      <Link href={`/clients/${r.clientId}`} className="font-medium text-ink hover:text-indigo-600 transition">{r.clientName}</Link>
                    </td>
                    <td className="py-2 pr-3 text-ink-3 tnum">{r.carrier} · {r.policyNumber.slice(-8)}</td>
                    <td className="py-2 pr-3 text-ink-2">{r.reason || "—"}</td>
                    <td className="py-2 pr-3 text-right tnum">{r.amount > 0 ? inr(r.amount) : "—"}</td>
                    <td className="py-2 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px]">
                        {statusIcon(r.status)} {r.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right text-ink-3 tnum">{r.daysSinceIntimated}d</td>
                    <td className="py-2 text-center">
                      {r.tatAlert === "overdue" && <span className="pill pill-red">Chase</span>}
                      {r.tatAlert === "warning" && <span className="pill pill-amber">Soon</span>}
                      {r.tatAlert === "ok" && <span className="text-[11px] text-ink-3">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="py-4 text-center text-sm text-ink-3">No claims match this filter.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
