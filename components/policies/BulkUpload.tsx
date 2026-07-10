"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, CheckCircle2, Lock, AlertTriangle, Copy, Building2, UserPlus } from "lucide-react";
import { bulkUploadPolicies, bulkUploadRenewals, type BulkOutcome } from "@/app/policies/bulk-actions";

const MAX_BATCH_BYTES = 6 * 1024 * 1024; // keep each request under the server-action limit

function batchBySize(files: File[]): File[][] {
  const out: File[][] = [];
  let cur: File[] = [], size = 0;
  for (const f of files) {
    if (cur.length && size + f.size > MAX_BATCH_BYTES) { out.push(cur); cur = []; size = 0; }
    cur.push(f); size += f.size;
  }
  if (cur.length) out.push(cur);
  return out;
}

export function BulkUpload({ mode }: { mode: "policies" | "renewals" }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [total, setTotal] = useState(0);
  const [outcomes, setOutcomes] = useState<BulkOutcome[]>([]);

  const run = async () => {
    const files = Array.from(fileRef.current?.files ?? []).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!files.length) return;
    setRunning(true); setDone(false); setProcessed(0); setTotal(files.length); setOutcomes([]);

    for (const slice of batchBySize(files)) {
      try {
        const fd = new FormData();
        slice.forEach((f) => fd.append("files", f));
        const r = mode === "policies" ? await bulkUploadPolicies(fd) : await bulkUploadRenewals(fd);
        setOutcomes((prev) => [...prev, ...r.outcomes]);
      } catch {
        setOutcomes((prev) => [...prev, ...slice.map((f) => ({ file: f.name, status: "unreadable" as const }))]);
      }
      setProcessed((p) => p + slice.length);
    }
    setRunning(false); setDone(true);
    router.refresh();
  };

  const pct = total ? Math.round((processed / total) * 100) : 0;
  const by = (s: BulkOutcome["status"]) => outcomes.filter((o) => o.status === s);
  const created = by(mode === "policies" ? "created" : "updated");
  const duplicates = by("duplicate");
  const noMatch = by("no_match");
  const unreadable = by("unreadable");

  // classification breakdown by insurer (across everything that was read)
  const insurerCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of outcomes) if (o.insurer) m.set(o.insurer, (m.get(o.insurer) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [outcomes]);
  const createdFromNotice = mode === "renewals" ? by("created") : [];

  const primaryLabel = mode === "policies" ? "New policies added" : "Renewals updated";
  const dropHint = mode === "policies"
    ? "Drop or select all your policy-copy PDFs. Duplicates (by policy number) are skipped and listed."
    : "Drop or select renewal-notice PDFs. Each is attached to its existing policy.";

  return (
    <div className="card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Upload size={15} className="text-accent" /> {mode === "policies" ? "Bulk upload policies" : "Bulk upload renewal notices"}
      </h2>
      <p className="mt-1 text-xs text-ink-3">{dropHint} Handles up to ~1000 PDFs — processed in batches.</p>

      <div className="mt-4 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-8 text-center" style={{ borderColor: "var(--border-2)" }}>
        <FileText size={26} className="text-ink-3" />
        <input ref={fileRef} type="file" accept=".pdf" multiple className="text-xs text-ink-2 file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white" />
        <p className="text-[11px] text-ink-4">Tip: open the folder, press <kbd className="rounded bg-surface-3 px-1">Ctrl+A</kbd> to select every PDF.</p>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-ink-4"><Lock size={11} style={{ color: "var(--accent)" }} /> Read locally &amp; encrypted on disk — nothing is sent anywhere except your own AI key when a format is new.</div>

      {running && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-ink-3"><span>Processing… {processed}/{total}</span><span>{pct}%</span></div>
          <div style={{ background: "var(--surface-3)", borderRadius: 999, height: 8 }}><div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: "var(--accent)", transition: "width .3s" }} /></div>
        </div>
      )}

      {done && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg px-2.5 py-1.5 font-medium" style={{ background: "var(--emerald-50)", color: "var(--emerald-700)" }}><CheckCircle2 size={13} className="mr-1 inline" />{created.length} {primaryLabel}</span>
            {duplicates.length > 0 && <span className="rounded-lg px-2.5 py-1.5 font-medium" style={{ background: "var(--amber-50)", color: "var(--amber-700)" }}><Copy size={13} className="mr-1 inline" />{duplicates.length} duplicate{duplicates.length > 1 ? "s" : ""} skipped</span>}
            {noMatch.length > 0 && <span className="rounded-lg px-2.5 py-1.5 font-medium" style={{ background: "var(--amber-50)", color: "var(--amber-700)" }}><AlertTriangle size={13} className="mr-1 inline" />{noMatch.length} no matching policy</span>}
            {unreadable.length > 0 && <span className="rounded-lg px-2.5 py-1.5 font-medium" style={{ background: "var(--red-50)", color: "var(--red-700)" }}><AlertTriangle size={13} className="mr-1 inline" />{unreadable.length} unreadable</span>}
          </div>

          {insurerCounts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
              <Building2 size={13} /> <span className="font-medium">Classified:</span>
              {insurerCounts.map(([name, n]) => <span key={name} className="rounded-md px-2 py-0.5" style={{ background: "var(--surface-3)" }}>{name} · {n}</span>)}
            </div>
          )}
          {mode === "renewals" && createdFromNotice.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl p-3 text-xs" style={{ background: "var(--accent-50)", color: "var(--accent-700)" }}>
              <UserPlus size={14} className="mt-0.5 shrink-0" />
              <span><strong>{createdFromNotice.length}</strong> new {createdFromNotice.length > 1 ? "policies were" : "policy was"} created from renewal notices that weren&apos;t in the system yet — a renewal notice means a near-certain renewal, so nothing was dropped. Review them under Policy Holders.</span>
            </div>
          )}

          {duplicates.length > 0 && (
            <details className="rounded-xl p-3 text-xs" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
              <summary className="cursor-pointer font-medium" style={{ color: "var(--amber-700)" }}>Duplicates skipped ({duplicates.length}) — already in the system</summary>
              <ul className="mt-2 space-y-0.5 text-ink-2">
                {duplicates.map((o, i) => <li key={i} className="tnum">• {o.file} — policy {o.policyNumber}{o.matchedExisting && o.matchedExisting !== o.policyNumber ? ` (matches existing ${o.matchedExisting})` : ""}</li>)}
              </ul>
            </details>
          )}
          {noMatch.length > 0 && (
            <details className="rounded-xl p-3 text-xs" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
              <summary className="cursor-pointer font-medium" style={{ color: "var(--amber-700)" }}>No matching policy ({noMatch.length}) — add the policy first under Policies</summary>
              <ul className="mt-2 space-y-0.5 text-ink-2">
                {noMatch.map((o, i) => <li key={i} className="tnum">• {o.file} — policy {o.policyNumber}</li>)}
              </ul>
            </details>
          )}
          {unreadable.length > 0 && (
            <details className="rounded-xl p-3 text-xs" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
              <summary className="cursor-pointer font-medium" style={{ color: "var(--red-700)" }}>Couldn&apos;t read ({unreadable.length}) — may be scans without a text layer</summary>
              <ul className="mt-2 space-y-0.5 text-ink-2">{unreadable.map((o, i) => <li key={i}>• {o.file}</li>)}</ul>
            </details>
          )}
          {mode === "policies" && created.filter((o) => o.newHolder).length > 0 && (
            <p className="text-[11px] text-ink-4">{created.filter((o) => o.newHolder).length} new policy holder{created.filter((o) => o.newHolder).length > 1 ? "s" : ""} created from these PDFs.</p>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button onClick={run} disabled={running} className="btn btn-accent">{running ? "Processing…" : <><Upload size={15} /> Upload &amp; process</>}</button>
      </div>
    </div>
  );
}
