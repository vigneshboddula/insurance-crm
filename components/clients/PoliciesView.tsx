"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, FileText, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { inr, fmtDate, daysUntil } from "@/lib/format";
import { labelOf, LINES, POLICY_STATUS } from "@/lib/enums";
import { PoliciesAddDialog } from "./PoliciesAddDialog";
import { BulkUpload } from "@/components/policies/BulkUpload";

type Policy = { id: string; clientId: string; clientName: string; line: string; carrier: string; policyNumber: string; planName: string | null; premium: number; sumAssured: number; renewalDate: string; startDate: string; status: string };

type Props = {
  policies: Policy[];
  clients: { id: string; name: string }[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  view: "recent" | "all";
  activePremium: number;
};

// Search + paging are server-side (URL-driven) so the page stays fast at 10k+
// policies — this component only renders the current page of rows.
export function PoliciesView({ policies, clients, total, page, pageSize, q, view, activePremium }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [showBulk, setShowBulk] = useState(false);
  const [term, setTerm] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setTerm(q), [q]);

  const setUrl = (next: { q?: string; view?: string; page?: number }) => {
    const p = new URLSearchParams(params.toString());
    if (next.q !== undefined) { next.q ? p.set("q", next.q) : p.delete("q"); p.delete("page"); }
    if (next.view !== undefined) { next.view === "all" ? p.set("view", "all") : p.delete("view"); p.delete("page"); }
    if (next.page !== undefined) { next.page > 1 ? p.set("page", String(next.page)) : p.delete("page"); }
    router.replace(`/policies${p.size ? `?${p}` : ""}`);
  };

  const onSearch = (v: string) => {
    setTerm(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setUrl({ q: v.trim() }), 350);
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Policies {view === "recent" ? "· Recently Issued" : ""}</h1>
          <p className="text-xs text-ink-3">{total} {view === "recent" ? `issued in the last 30 days` : "policies"}{q ? ` matching “${q}”` : ""} · {inr(activePremium)} active premium</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface-3)" }}>
            <button onClick={() => setUrl({ view: "recent" })} className="rounded-md px-2.5 py-1 text-xs font-medium transition" style={view === "recent" ? { background: "var(--surface)", color: "var(--ink)" } : { color: "var(--ink-3)" }}>Recently issued</button>
            <button onClick={() => setUrl({ view: "all" })} className="rounded-md px-2.5 py-1 text-xs font-medium transition" style={view === "all" ? { background: "var(--surface)", color: "var(--ink)" } : { color: "var(--ink-3)" }}>All</button>
          </div>
          <button onClick={() => setShowBulk((v) => !v)} className="btn"><Upload size={15} /> Bulk upload</button>
          <PoliciesAddDialog clients={clients} />
        </div>
      </div>

      {showBulk && <BulkUpload mode="policies" />}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
        <input value={term} onChange={(e) => onSearch(e.target.value)} placeholder="Search by client, carrier, policy number…" className="w-full rounded-xl border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }} />
      </div>

      {policies.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <FileText size={28} className="text-ink-4" />
          <p className="mt-2 text-sm font-medium text-ink">{q ? "No policies match." : view === "recent" ? "Nothing issued in the last 30 days." : "No policies yet."}</p>
          <p className="text-xs text-ink-3">{q ? "Try another search." : "Use Bulk upload or Add policy above."}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {policies.map((p) => {
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

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button onClick={() => setUrl({ page: page - 1 })} disabled={page <= 1} className="btn disabled:opacity-40"><ChevronLeft size={15} /> Prev</button>
          <span className="text-ink-3 tnum">Page {page} of {pages}</span>
          <button onClick={() => setUrl({ page: page + 1 })} disabled={page >= pages} className="btn disabled:opacity-40">Next <ChevronRight size={15} /></button>
        </div>
      )}
    </div>
  );
}
