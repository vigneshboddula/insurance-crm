"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, UserPlus, Users, FileText, Archive, RotateCcw, Upload, Pencil, ChevronDown } from "lucide-react";
import { AddClientDialog } from "./AddClientDialog";
import { restoreClient } from "@/app/clients/actions";

type Client = { id: string; name: string; phone: string; email: string | null; household: string | null; tags: string | null; policyCount: number; needsReview: number };

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function ClientsView({ clients, households, archived }: { clients: Client[]; households: { id: string; name: string }[]; archived: { id: string; name: string; phone: string }[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter((c) => [c.name, c.phone, c.email, c.tags].some((f) => f?.toLowerCase().includes(t)));
  }, [q, clients]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Policy Holders</h1>
          <p className="text-xs text-ink-3">{clients.length} {clients.length === 1 ? "holder" : "holders"} in your book</p>
        </div>
        <div className="relative">
          <button onClick={() => setMenu((v) => !v)} className="btn btn-accent">
            <UserPlus size={15} /> Add holder <ChevronDown size={13} className={menu ? "rotate-180 transition" : "transition"} />
          </button>
          {menu && (
            <div onMouseLeave={() => setMenu(false)} className="absolute right-0 z-30 mt-1 w-64 overflow-hidden rounded-xl border bg-surface py-1" style={{ borderColor: "var(--border-2)", boxShadow: "var(--shadow-lg)" }}>
              <Link href="/policies" onClick={() => setMenu(false)} className="flex items-start gap-2.5 px-3 py-2 hover:bg-surface-2">
                <Upload size={15} className="mt-0.5 text-accent" />
                <span><span className="block text-sm text-ink">Bulk upload policy PDFs</span><span className="block text-[11px] text-ink-3">Add policies &amp; holders from a folder of PDFs</span></span>
              </Link>
              <button onClick={() => { setMenu(false); setOpen(true); }} className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-surface-2">
                <Pencil size={15} className="mt-0.5 text-ink-2" />
                <span><span className="block text-sm text-ink">Enter manually</span><span className="block text-[11px] text-ink-3">Type the holder's details yourself</span></span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone, email or tag…"
          className="w-full rounded-xl border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent"
          style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Users size={28} className="text-ink-4" />
          <p className="mt-2 text-sm font-medium text-ink">{q ? "No clients match your search." : "No clients yet."}</p>
          <p className="text-xs text-ink-3">{q ? "Try a different term." : "Add your first client to get started."}</p>
          {!q && <button onClick={() => setOpen(true)} className="btn btn-accent mt-3"><UserPlus size={15} /> Add client</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="card card-hover p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold" style={{ background: "var(--accent-50)", color: "var(--accent-700)" }}>{initials(c.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-ink">{c.name}</div>
                  <div className="truncate text-xs text-ink-3 tnum">{c.phone || "no phone"}</div>
                </div>
                {c.needsReview > 0 && <span className="pill pill-amber shrink-0" title="Missing required details">{c.needsReview}</span>}
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-3">
                <span className="inline-flex items-center gap-1"><FileText size={12} /> {c.policyCount} {c.policyCount === 1 ? "policy" : "policies"}</span>
              </div>
              {c.tags && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.split(",").map((t) => (
                    <span key={t} className="pill-gray pill">{t.trim()}</span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div>
          <button onClick={() => setShowArchived((v) => !v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-3 hover:text-ink">
            <Archive size={13} /> Archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-1">
              {archived.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: "var(--surface-2)" }}>
                  <Link href={`/clients/${a.id}`} className="min-w-0 flex-1">
                    <span className="truncate text-sm font-medium text-ink-2">{a.name}</span>
                    <span className="ml-2 text-xs text-ink-4 tnum">{a.phone}</span>
                  </Link>
                  <button onClick={() => start(async () => { await restoreClient(a.id); router.refresh(); })} className="btn"><RotateCcw size={13} /> Restore</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AddClientDialog open={open} onClose={() => setOpen(false)} households={households} />
    </div>
  );
}
