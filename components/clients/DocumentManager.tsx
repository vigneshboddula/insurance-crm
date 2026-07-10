"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Image as ImageIcon, Eye, Trash2, Upload, MessageCircle, Lock, Sparkles, CheckCircle2, Info } from "lucide-react";
import { Field, Select } from "@/components/ui/form";
import { uploadAndScan, deleteDocument, type ScanResult } from "@/app/clients/actions";
import { DOC_TYPES, labelOf } from "@/lib/enums";
import { waLink } from "@/lib/links";

type Doc = { id: string; type: string; label: string | null; fileName: string; mimeType: string; sizeBytes: number; uploadedAt: string };

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// policy copies and renewal notices must never be mixed
const BUCKETS: { key: string; label: string; types: string[] }[] = [
  { key: "policies", label: "Policy Copies", types: ["policy_copy", "policy"] },
  { key: "notices", label: "Renewal Notices", types: ["renewal_notice"] },
  { key: "kyc", label: "KYC & ID", types: ["aadhaar", "pan", "nominee_id_proof", "birth_certificate", "address_proof", "photo"] },
  { key: "claims", label: "Claims", types: ["claim"] },
  { key: "other", label: "Other", types: ["proposal", "other"] },
];
function bucketOf(type: string) {
  return BUCKETS.find((b) => b.types.includes(type))?.key ?? "other";
}

// Policy copies & renewal notices are uploaded on the Policies / Renewals pages,
// not here — the holder page is for identity/KYC docs only.
const UPLOAD_TYPES = DOC_TYPES.filter((t) => !["policy_copy", "renewal_notice", "policy"].includes(t.value));

export function DocumentManager({ clientId, documents, clientPhone }: { clientId: string; documents: Doc[]; clientPhone: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const onUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setScanning(true);
    setResult(null);
    start(async () => {
      const r = await uploadAndScan(fd);
      setResult(r);
      setScanning(false);
      formRef.current?.reset();
      router.refresh();
    });
  };

  const [armedDoc, setArmedDoc] = useState<string | null>(null);
  const remove = (id: string) => {
    if (armedDoc !== id) {
      setArmedDoc(id);
      setTimeout(() => setArmedDoc((v) => (v === id ? null : v)), 3500);
      return;
    }
    setArmedDoc(null);
    start(async () => {
      await deleteDocument(id, clientId);
      router.refresh();
    });
  };

  return (
    <section className="card">
      <h2 className="flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-semibold text-ink"><FileText size={15} className="text-ink-3" /> Documents <span className="text-ink-3">({documents.length})</span></h2>

      <div className="px-5">
        <form ref={formRef} onSubmit={onUpload} className="flex flex-wrap items-end gap-2 rounded-xl p-3" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
          <input type="hidden" name="clientId" value={clientId} />
          <div className="w-36"><Field label="Type"><Select name="type" options={UPLOAD_TYPES} defaultValue="aadhaar" /></Field></div>
          <div className="min-w-[160px] flex-1">
            <Field label="File">
              <input name="file" type="file" required className="w-full text-xs text-ink-2 file:mr-2 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white" />
            </Field>
          </div>
          <button type="submit" disabled={scanning} className="btn btn-accent">
            {scanning ? <>Uploading…</> : <><Upload size={14} /> Upload</>}
          </button>
        </form>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-ink-4"><Lock size={11} style={{ color: "var(--accent)" }} /> Read &amp; encrypted locally. Policy copies &amp; renewal notices are uploaded on the <a href="/policies" className="font-medium text-accent-700">Policies</a> &amp; <a href="/renewals" className="font-medium text-accent-700">Renewals</a> pages.</div>

        {result && (
          <div className="mt-2 rounded-xl p-3" style={{ background: result.updated.length ? "var(--emerald-50)" : "var(--surface-2)", border: "0.5px solid var(--border)" }}>
            {result.duplicate ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: "var(--amber-700)" }}><Info size={15} /> “{result.fileName}” is already on this holder — skipped the duplicate.</div>
            ) : result.updated.length ? (
              <>
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--emerald-700)" }}><CheckCircle2 size={15} /> Scanned &amp; updated {result.updated.length} field{result.updated.length > 1 ? "s" : ""}:</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {result.updated.map((u, i) => (
                    <span key={i} className="rounded-lg px-2 py-1 text-[11px]" style={{ background: "var(--surface)", color: "var(--ink-2)" }}>✓ {u.label}: <span className="font-medium text-ink tnum">{u.value}</span></span>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-start gap-2 text-sm" style={{ color: "var(--ink-2)" }}><Info size={15} className="mt-0.5 shrink-0 text-ink-3" /> {result.note ?? "Stored — no matching fields to update from this document."}</div>
            )}
          </div>
        )}
      </div>

      <div className="px-3 py-3">
        {documents.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-ink-3">No documents yet — upload a policy copy, renewal notice, Aadhaar, PAN, etc.</p>
        ) : (
          <div className="space-y-3">
            {BUCKETS.map((b) => {
              const docs = documents.filter((d) => bucketOf(d.type) === b.key);
              if (docs.length === 0) return null;
              return (
                <div key={b.key}>
                  <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-4">{b.label} <span className="text-ink-4">({docs.length})</span></div>
                  <ul className="space-y-1">
                    {docs.map((d) => {
                      const isImg = d.mimeType.startsWith("image/");
                      return (
                        <li key={d.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--surface-3)" }}>
                            {isImg ? <ImageIcon size={16} className="text-ink-2" /> : <FileText size={16} className="text-ink-2" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-ink">{d.label || d.fileName}</div>
                            <div className="truncate text-[11px] text-ink-3">{labelOf(DOC_TYPES, d.type)} · {size(d.sizeBytes)}</div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <a href={`/api/documents/${d.id}`} target="_blank" rel="noopener" className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3" title="View / download" aria-label="View"><Eye size={14} className="text-ink-2" /></a>
                            <a href={waLink(clientPhone)} target="_blank" rel="noopener" className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3" title="Send on WhatsApp (one-click in Phase 3)" aria-label="WhatsApp"><MessageCircle size={14} style={{ color: "var(--emerald)" }} /></a>
                            {armedDoc === d.id ? (
                              <button onClick={() => remove(d.id)} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-white" style={{ background: "var(--red)" }}><Trash2 size={12} /> Delete forever?</button>
                            ) : (
                              <button onClick={() => remove(d.id)} className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-3" title="Delete" aria-label="Delete"><Trash2 size={14} style={{ color: "var(--red)" }} /></button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
