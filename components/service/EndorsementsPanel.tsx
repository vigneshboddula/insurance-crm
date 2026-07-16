"use client";

import { useState } from "react";
import Link from "next/link";
import { FileEdit, CheckCircle2, Clock, XCircle, Search } from "lucide-react";
import { fmtDate } from "@/lib/format";
import type { EndorsementRow, EndorsementSummary } from "@/lib/service";

type FilterKey = "all" | "requested" | "submitted" | "approved" | "rejected";

const TYPE_LABELS: Record<string, string> = {
  address_change: "Address change",
  nominee_change: "Nominee change",
  sum_insured: "Sum insured",
  member_add: "Add member",
  member_remove: "Remove member",
  vehicle_transfer: "Vehicle transfer",
  other: "Other",
};

export function EndorsementsPanel({ rows, summary }: { rows: EndorsementRow[]; summary: EndorsementSummary }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.clientName.toLowerCase().includes(q) && !r.policyNumber.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: summary.total },
    { key: "requested", label: "Requested", count: summary.requested },
    { key: "submitted", label: "Submitted", count: summary.submitted },
    { key: "approved", label: "Approved", count: summary.approved },
    { key: "rejected", label: "Rejected", count: summary.rejected },
  ];

  const statusBadge = (status: string) => {
    if (status === "approved") return <span className="pill pill-green"><CheckCircle2 size={11} className="mr-0.5" /> Approved</span>;
    if (status === "rejected") return <span className="pill pill-red"><XCircle size={11} className="mr-0.5" /> Rejected</span>;
    if (status === "submitted") return <span className="pill pill-amber"><Clock size={11} className="mr-0.5" /> Submitted</span>;
    return <span className="pill pill-gray"><Clock size={11} className="mr-0.5" /> Requested</span>;
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5 pb-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <FileEdit size={15} className="text-ink-3" /> Servicing requests
        </h2>
        <span className="text-[11px] text-ink-3">{summary.total} endorsements</span>
        {summary.requested + summary.submitted > 0 && (
          <span className="text-[11px] font-medium" style={{ color: "var(--amber-700)" }}>
            {summary.requested + summary.submitted} pending
          </span>
        )}
      </div>

      {summary.total === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink-3">No servicing requests yet. Endorsements (name change, nominee update, etc.) will appear here.</p>
      ) : (
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, policy…" className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
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
                  <th className="pb-1.5 text-left font-medium">Type</th>
                  <th className="pb-1.5 text-left font-medium">Description</th>
                  <th className="pb-1.5 text-center font-medium">Status</th>
                  <th className="pb-1.5 text-right font-medium">Requested</th>
                  <th className="pb-1.5 text-right font-medium">Pending</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-surface-2 transition" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 pr-3">
                      <Link href={`/clients/${r.clientId}`} className="font-medium text-ink hover:text-indigo-600 transition">{r.clientName}</Link>
                    </td>
                    <td className="py-2 pr-3 text-ink-3 tnum">{r.carrier} · {r.policyNumber.slice(-8)}</td>
                    <td className="py-2 pr-3 text-ink-2">{TYPE_LABELS[r.type] ?? r.type}</td>
                    <td className="py-2 pr-3 text-ink-3 truncate max-w-[200px]">{r.description || "—"}</td>
                    <td className="py-2 text-center">{statusBadge(r.status)}</td>
                    <td className="py-2 pr-3 text-right text-ink-3 tnum">{fmtDate(r.requestedAt)}</td>
                    <td className="py-2 text-right tnum">
                      {r.daysPending !== null ? (
                        <span style={{ color: r.daysPending > 14 ? "var(--red)" : r.daysPending > 7 ? "var(--amber-700)" : undefined }}>{r.daysPending}d</span>
                      ) : <span className="text-ink-3">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="py-4 text-center text-sm text-ink-3">No endorsements match this filter.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
