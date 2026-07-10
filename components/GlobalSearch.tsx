"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, User, FileText, Target, Loader2, CornerDownLeft } from "lucide-react";

type Result = { type: "client" | "policy" | "lead"; id: string; name: string; sub: string; href: string };

const ICON = { client: User, policy: FileText, lead: Target };
const GROUP = { client: "Policy Holders", policy: "Policies", lead: "Leads" };

export function GlobalSearch({ variant = "bar" }: { variant?: "bar" | "compact" }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = q.trim();
    if (!t) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(t)}`, { cache: "no-store" });
        const d = await r.json();
        setResults(d.results ?? []);
        setSel(0);
      } catch { setResults([]); }
      setLoading(false);
    }, 180);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const go = (r?: Result) => {
    const item = r ?? results[sel];
    if (!item) return;
    setOpen(false); setQ("");
    router.push(item.href);
  };

  let lastGroup = "";

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-2 rounded-xl border bg-surface px-3" style={{ borderColor: "var(--border-2)", borderWidth: "0.5px" }}>
        <Search size={16} className="shrink-0 text-ink-4" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter") { e.preventDefault(); go(); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={variant === "compact" ? "Search…" : "Search by customer name or policy number…"}
          className={`w-full bg-transparent outline-none placeholder:text-ink-4 ${variant === "compact" ? "py-1.5 text-xs" : "py-2.5 text-sm"}`}
        />
        {loading && <Loader2 size={14} className="shrink-0 animate-spin text-ink-4" />}
      </div>

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border bg-surface py-1" style={{ borderColor: "var(--border-2)", boxShadow: "var(--shadow-lg)", maxHeight: 360, overflowY: "auto" }}>
          {results.length === 0 ? (
            <div className="px-4 py-4 text-center text-xs text-ink-3">{loading ? "Searching…" : `No matches for “${q}”.`}</div>
          ) : (
            results.map((r, idx) => {
              const Icon = ICON[r.type];
              const showGroup = GROUP[r.type] !== lastGroup;
              lastGroup = GROUP[r.type];
              const active = idx === sel;
              return (
                <div key={r.type + r.id}>
                  {showGroup && <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-4">{GROUP[r.type]}</div>}
                  <button
                    onMouseEnter={() => setSel(idx)}
                    onClick={() => go(r)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
                    style={{ background: active ? "var(--accent-50)" : "transparent" }}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: active ? "var(--accent-100)" : "var(--surface-3)" }}>
                      <Icon size={13} className={active ? "text-accent-700" : "text-ink-2"} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{r.name}</span>
                      {r.sub && <span className="block truncate text-[11px] text-ink-3 tnum">{r.sub}</span>}
                    </span>
                    {active && <CornerDownLeft size={12} className="shrink-0 text-ink-4" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
