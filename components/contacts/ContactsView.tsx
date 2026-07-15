"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Upload, Search, Pencil, Check, X, CheckCircle2, AlertTriangle, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { importContacts, updateContact, type ContactImportResult } from "@/app/contacts/actions";

export type Contact = { policyNumber: string; name: string; phone: string; email: string; carrier: string; policyType: string | null };

type Props = {
  contacts: Contact[];
  carriers: string[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  filter: "all" | "no_phone" | "no_email";
  carrier: string;
  counts: { all: number; noPhone: number; noEmail: number };
};

// Filters / search / paging are server-side (URL params) so this stays fast at
// 10k+ policies — the browser only renders one page of rows.
export function ContactsView({ contacts, carriers, total, page, pageSize, q, filter, carrier, counts }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();
  const [term, setTerm] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ContactImportResult | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ phone: string; email: string }>({ phone: "", email: "" });

  useEffect(() => setTerm(q), [q]);

  const setUrl = (next: { q?: string; filter?: string; carrier?: string; page?: number }) => {
    const p = new URLSearchParams(params.toString());
    if (next.q !== undefined) { next.q ? p.set("q", next.q) : p.delete("q"); p.delete("page"); }
    if (next.filter !== undefined) { next.filter !== "all" ? p.set("filter", next.filter) : p.delete("filter"); p.delete("page"); }
    if (next.carrier !== undefined) { next.carrier ? p.set("carrier", next.carrier) : p.delete("carrier"); p.delete("page"); }
    if (next.page !== undefined) { next.page > 1 ? p.set("page", String(next.page)) : p.delete("page"); }
    router.replace(`/contacts${p.size ? `?${p}` : ""}`);
  };

  const onSearch = (v: string) => {
    setTerm(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setUrl({ q: v.trim() }), 350);
  };

  const onUpload = () => {
    const f = fileRef.current?.files?.[0];
    if (!f) return;
    setUploading(true); setResult(null);
    start(async () => {
      try {
        const fd = new FormData(); fd.set("file", f);
        setResult(await importContacts(fd));
      } catch (e) { alert("Import failed: " + (e instanceof Error ? e.message : "error")); }
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  };

  const saveEdit = (policyNumber: string) => {
    start(async () => { await updateContact(policyNumber, draft.phone, draft.email); setEdit(null); router.refresh(); });
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));

  const chip = (key: "all" | "no_phone" | "no_email", label: string, count: number) => (
    <button onClick={() => setUrl({ filter: key })} className="rounded-lg px-2.5 py-1 text-xs font-medium transition" style={filter === key ? { background: "var(--accent-50)", color: "var(--accent-700)" } : { background: "var(--surface-3)", color: "var(--ink-3)" }}>
      {label} ({count})
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-ink"><Users size={18} /> Contacts</h1>
          <p className="text-xs text-ink-3">{total} {q || filter !== "all" || carrier ? "matching" : ""} policies · download, fill phone/email offline, re-upload to bulk-update.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/contacts/export" className="btn"><Download size={15} /> Download Excel</a>
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn btn-accent"><Upload size={15} /> {uploading ? "Uploading…" : "Upload Excel"}</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onUpload} />
        </div>
      </div>

      {result && (
        <div className="rounded-xl p-3 text-sm" style={{ background: "var(--emerald-50)", border: "0.5px solid var(--border)" }}>
          <div className="flex items-center gap-2 font-medium" style={{ color: "var(--emerald-700)" }}><CheckCircle2 size={15} /> Updated {result.updated} of {result.total} rows.</div>
          {result.notFound.length > 0 && (
            <details className="mt-1 text-xs"><summary className="cursor-pointer" style={{ color: "var(--amber-700)" }}><AlertTriangle size={12} className="mr-1 inline" />{result.notFound.length} policy numbers not found</summary>
              <ul className="mt-1 space-y-0.5 text-ink-2">{result.notFound.slice(0, 40).map((n, i) => <li key={i} className="tnum">• {n.policyNumber} {n.name && `— ${n.name}`}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {chip("all", "All", counts.all)}
        {chip("no_phone", "Missing phone", counts.noPhone)}
        {chip("no_email", "Missing Gmail", counts.noEmail)}
        <select value={carrier} onChange={(e) => setUrl({ carrier: e.target.value })} className="rounded-lg border bg-surface px-2 py-1 text-xs" style={{ borderColor: "var(--border-2)" }}>
          <option value="">All companies</option>
          {carriers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4" />
          <input value={term} onChange={(e) => onSearch(e.target.value)} placeholder="Search…" className="w-full rounded-lg border bg-surface py-1.5 pl-8 pr-2 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-ink-4" style={{ borderColor: "var(--border)" }}>
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Policy number</th>
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Phone</th>
              <th className="px-3 py-2 font-semibold">Gmail</th>
              <th className="px-3 py-2 font-semibold">Company / Type</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, i) => {
              const editing = edit === c.policyNumber;
              return (
                <tr key={c.policyNumber} className="border-b last:border-0 hover:bg-surface-2" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 text-ink-4 tnum">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-3 py-2 tnum text-ink-2">{c.policyNumber}</td>
                  <td className="px-3 py-2 font-medium text-ink">{c.name}</td>
                  <td className="px-3 py-2 tnum">
                    {editing ? <input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} className="w-28 rounded border px-1.5 py-0.5 text-sm" style={{ borderColor: "var(--border-2)" }} /> : (c.phone || <span style={{ color: "var(--amber-700)" }}>—</span>)}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? <input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} className="w-44 rounded border px-1.5 py-0.5 text-sm" style={{ borderColor: "var(--border-2)" }} /> : (c.email || <span style={{ color: "var(--amber-700)" }}>—</span>)}
                  </td>
                  <td className="px-3 py-2 text-ink-3">{c.carrier}{c.policyType ? ` · ${c.policyType === "floater" ? "Floater" : "Individual"}` : ""}</td>
                  <td className="px-3 py-2 text-right">
                    {editing ? (
                      <span className="flex justify-end gap-1">
                        <button onClick={() => saveEdit(c.policyNumber)} className="rounded p-1 hover:bg-surface-3" title="Save"><Check size={15} style={{ color: "var(--emerald)" }} /></button>
                        <button onClick={() => setEdit(null)} className="rounded p-1 hover:bg-surface-3" title="Cancel"><X size={15} className="text-ink-3" /></button>
                      </span>
                    ) : (
                      <button onClick={() => { setEdit(c.policyNumber); setDraft({ phone: c.phone, email: c.email }); }} className="rounded p-1 hover:bg-surface-3" title="Edit"><Pencil size={14} className="text-ink-3" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
            {contacts.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-ink-3">No contacts match.</td></tr>}
          </tbody>
        </table>
      </div>

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
