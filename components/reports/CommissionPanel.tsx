"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { IndianRupee, ChevronDown, Upload, AlertTriangle, CheckCircle2, Search, Filter } from "lucide-react";
import { inr } from "@/lib/format";
import type { CommissionRow, CommissionSummary } from "@/lib/commissions";
import { importCommissionStatement, type CommissionImportResult } from "@/app/reports/commission-actions";

type Props = {
  rows: CommissionRow[];
  summary: CommissionSummary;
};

type FilterKey = "all" | "pending" | "received" | "shortfall";

export function CommissionPanel({ rows, summary }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<CommissionImportResult | null>(null);
  const [importError, setImportError] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = rows.filter((r) => {
    if (filter === "pending" && r.status !== "pending") return false;
    if (filter === "received" && r.status !== "received") return false;
    if (filter === "shortfall" && r.shortfall <= 0) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.clientName.toLowerCase().includes(q) && !r.policyNumber.toLowerCase().includes(q) && !r.carrier.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setImportError("");
    setImportResult(null);
    startTransition(async () => {
      try {
        const res = await importCommissionStatement(fd);
        setImportResult(res);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Import failed");
      }
    });
  };

  const chips: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "pending", label: "Pending", count: summary.pendingCount },
    { key: "received", label: "Received", count: summary.paidCount },
    { key: "shortfall", label: "Shortfall", count: summary.shortfallCount },
  ];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5 pb-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <IndianRupee size={15} className="text-ink-3" /> Commission tracker
        </h2>
        <button
          onClick={() => setShowImport((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-2 transition hover:bg-surface-3"
        >
          <Upload size={13} /> Import statement
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 px-4 pb-3">
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-[11px] text-ink-3">Expected</div>
          <div className="text-lg font-semibold tnum text-ink">{inr(summary.totalExpected)}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-[11px] text-ink-3">Received</div>
          <div className="text-lg font-semibold tnum" style={{ color: "var(--emerald-700)" }}>{inr(summary.totalReceived)}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-[11px] text-ink-3">Shortfall</div>
          <div className="text-lg font-semibold tnum" style={{ color: summary.totalShortfall > 0 ? "var(--red)" : "var(--emerald-700)" }}>
            {inr(summary.totalShortfall)}
          </div>
        </div>
      </div>

      {/* Import panel */}
      {showImport && (
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <form onSubmit={handleUpload} className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" name="file" accept=".xlsx,.xls,.csv" className="text-sm file:mr-2 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium file:bg-surface-3 file:text-ink-2 hover:file:bg-surface-4" />
            <button type="submit" disabled={isPending} className="btn btn-sm">{isPending ? "Importing…" : "Upload"}</button>
          </form>
          <p className="mt-1.5 text-[11px] text-ink-3">Excel with columns: policy number + commission amount. Auto-matches by policy number.</p>
          {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
          {importResult && (
            <div className="mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-3)" }}>
              <p className="font-medium" style={{ color: "var(--emerald-700)" }}>
                Matched {importResult.matched} of {importResult.total} rows
              </p>
              {importResult.notFound.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-[11px] text-ink-3">{importResult.notFound.length} not found</summary>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-ink-3">
                    {importResult.notFound.slice(0, 20).map((nf, i) => (
                      <li key={i}>{nf.policyNumber} — {inr(nf.amount)}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toggle detail */}
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-sm text-ink-2 hover:bg-surface-2 transition" style={{ borderColor: "var(--border)" }}>
        <Filter size={13} /> Policy-level breakdown
        <ChevronDown size={14} className={`ml-auto transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          {/* Search + filter chips */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client, policy, carrier…"
                className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-sm"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
              />
            </div>
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${filter === c.key ? "bg-indigo-600 text-white" : "text-ink-2 hover:bg-surface-3"}`}
              >
                {c.label} <span className="tnum">{c.count}</span>
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] text-ink-3" style={{ borderColor: "var(--border)" }}>
                  <th className="pb-1.5 text-left font-medium">Client</th>
                  <th className="pb-1.5 text-left font-medium">Policy</th>
                  <th className="pb-1.5 text-left font-medium">Carrier</th>
                  <th className="pb-1.5 text-right font-medium">Premium</th>
                  <th className="pb-1.5 text-right font-medium">Expected</th>
                  <th className="pb-1.5 text-right font-medium">Received</th>
                  <th className="pb-1.5 text-right font-medium">Shortfall</th>
                  <th className="pb-1.5 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((r) => (
                  <tr key={r.policyId} className="border-b last:border-0 hover:bg-surface-2 transition" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 pr-3">
                      <Link href={`/clients/${r.clientId}`} className="font-medium text-ink hover:text-indigo-600 transition">{r.clientName}</Link>
                    </td>
                    <td className="py-2 pr-3 text-ink-3 tnum">{r.policyNumber}</td>
                    <td className="py-2 pr-3 text-ink-3">{r.carrier}</td>
                    <td className="py-2 pr-3 text-right tnum">{inr(r.premium)}</td>
                    <td className="py-2 pr-3 text-right tnum">{inr(r.expected)}</td>
                    <td className="py-2 pr-3 text-right tnum" style={{ color: r.received > 0 ? "var(--emerald-700)" : undefined }}>{inr(r.received)}</td>
                    <td className="py-2 pr-3 text-right tnum" style={{ color: r.shortfall > 0 ? "var(--red)" : "var(--emerald-700)" }}>{inr(r.shortfall)}</td>
                    <td className="py-2 text-center">
                      {r.status === "received" ? (
                        r.shortfall > 0 ? (
                          <span className="pill pill-red">Shortfall</span>
                        ) : (
                          <span className="pill pill-green"><CheckCircle2 size={11} className="mr-0.5" /> Paid</span>
                        )
                      ) : (
                        <span className="pill pill-gray">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="py-4 text-center text-sm text-ink-3">No policies match this filter.</p>}
            {filtered.length > 100 && <p className="py-2 text-center text-[11px] text-ink-3">Showing first 100 of {filtered.length}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
