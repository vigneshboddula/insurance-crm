"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Search, Pencil, Check, X, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { importContacts, updateContact, type ContactImportResult } from "@/app/contacts/actions";

export type Contact = { policyNumber: string; name: string; phone: string; email: string; carrier: string; policyType: string | null };

type Filter = "all" | "no_phone" | "no_email";

export function ContactsView({ contacts, carriers }: { contacts: Contact[]; carriers: string[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [carrier, setCarrier] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ContactImportResult | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ phone: string; email: string }>({ phone: "", email: "" });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (filter === "no_phone" && c.phone) return false;
      if (filter === "no_email" && c.email) return false;
      if (carrier && !c.carrier.toLowerCase().includes(carrier.toLowerCase())) return false;
      if (t && ![c.name, c.policyNumber, c.phone, c.email, c.carrier].some((f) => f?.toLowerCase().includes(t))) return false;
      return true;
    });
  }, [contacts, q, filter, carrier]);

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

  const missingPhone = contacts.filter((c) => !c.phone).length;
  const missingEmail = contacts.filter((c) => !c.email).length;

  const chip = (key: Filter, label: string, count?: number) => (
    <button onClick={() => setFilter(key)} className="rounded-lg px-2.5 py-1 text-xs font-medium transition" style={filter === key ? { background: "var(--accent-50)", color: "var(--accent-700)" } : { background: "var(--surface-3)", color: "var(--ink-3)" }}>
      {label}{count !== undefined ? ` (${count})` : ""}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-ink"><Users size={18} /> Contacts</h1>
          <p className="text-xs text-ink-3">{contacts.length} policies · download, fill phone/email offline, re-upload to bulk-update.</p>
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
        {chip("all", "All", contacts.length)}
        {chip("no_phone", "Missing phone", missingPhone)}
        {chip("no_email", "Missing Gmail", missingEmail)}
        <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="rounded-lg border bg-surface px-2 py-1 text-xs" style={{ borderColor: "var(--border-2)" }}>
          <option value="">All companies</option>
          {carriers.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="relative ml-auto min-w-[200px] flex-1 sm:flex-none">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-4" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full rounded-lg border bg-surface py-1.5 pl-8 pr-2 text-sm outline-none focus:border-accent" style={{ borderColor: "var(--border-2)" }} />
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
            {filtered.map((c, i) => {
              const editing = edit === c.policyNumber;
              return (
                <tr key={c.policyNumber} className="border-b last:border-0 hover:bg-surface-2" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2 text-ink-4 tnum">{i + 1}</td>
                  <td className="px-3 py-2 tnum text-ink-2">{c.policyNumber}</td>
                  <td className="px-3 py-2 font-medium text-ink">{c.name}</td>
                  <td className="px-3 py-2 tnum">
                    {editing ? <input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} className="w-28 rounded border px-1.5 py-0.5 text-sm" style={{ borderColor: "var(--border-2)" }} /> : (c.phone || <span className="text-amber-700" style={{ color: "var(--amber-700)" }}>—</span>)}
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
            {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-ink-3">No contacts match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
