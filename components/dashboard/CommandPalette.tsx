"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, Users, FileText, Bell, Target, Stethoscope,
  CheckSquare, MessageCircle, Sparkles, UserPlus, CornerDownLeft, Upload,
  MessagesSquare, BarChart3,
} from "lucide-react";

type Item = { id: string; label: string; sub?: string; icon: React.ElementType; href: string; group: string };

const NAV: Item[] = [
  { id: "n-dash", label: "Dashboard", icon: LayoutDashboard, href: "/", group: "Go to" },
  { id: "n-cli", label: "Policy Holders", icon: Users, href: "/clients", group: "Go to" },
  { id: "n-pol", label: "Policies", icon: FileText, href: "/policies", group: "Go to" },
  { id: "n-ren", label: "Renewals", icon: Bell, href: "/renewals", group: "Go to" },
  { id: "n-led", label: "Leads", icon: Target, href: "/leads", group: "Go to" },
  { id: "n-clm", label: "Claims", icon: Stethoscope, href: "/claims", group: "Go to" },
  { id: "n-tsk", label: "Tasks", icon: CheckSquare, href: "/tasks", group: "Go to" },
  { id: "n-wa", label: "WhatsApp", icon: MessageCircle, href: "/whatsapp", group: "Go to" },
  { id: "n-com", label: "Communications", icon: MessagesSquare, href: "/communications", group: "Go to" },
  { id: "n-rep", label: "Reports", icon: BarChart3, href: "/reports", group: "Go to" },
  { id: "n-ai", label: "AI Assistant", icon: Sparkles, href: "/assistant", group: "Go to" },
  { id: "a-cli", label: "Add a policy holder", sub: "manual or from a PDF", icon: UserPlus, href: "/clients", group: "Actions" },
  { id: "a-imp", label: "Bulk upload policies", sub: "a folder of policy PDFs", icon: Upload, href: "/policies", group: "Actions" },
  { id: "a-ai", label: "Draft a message with AI", sub: "renewal, birthday, cross-sell", icon: Sparkles, href: "/assistant", group: "Actions" },
  { id: "a-rem", label: "Send renewal reminders", sub: "review the due queue", icon: Bell, href: "/renewals", group: "Actions" },
  { id: "a-log", label: "Log a call / note", icon: MessagesSquare, href: "/communications", group: "Actions" },
  { id: "a-led", label: "Add a lead", icon: Target, href: "/leads", group: "Actions" },
];

export function CommandPalette({ clients = [] }: { clients?: { id: string; name: string; phone: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cmdk-open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cmdk-open", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo(() => {
    const clientItems: Item[] = clients.map((c) => ({
      id: "c-" + c.id, label: c.name, sub: c.phone, icon: Users, href: `/clients/${c.id}`, group: "Clients",
    }));
    const all = [...NAV, ...clientItems];
    if (!q.trim()) return all;
    const t = q.toLowerCase();
    return all.filter((i) => i.label.toLowerCase().includes(t) || i.sub?.toLowerCase().includes(t) || i.group.toLowerCase().includes(t));
  }, [q, clients]);

  useEffect(() => setSel(0), [q]);

  if (!open) return null;

  const go = (i?: Item) => {
    const item = i ?? results[sel];
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  };

  let lastGroup = "";

  return (
    <div
      onClick={() => setOpen(false)}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(20,19,16,0.35)", backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pop-in"
        style={{ width: "min(560px,92vw)", background: "var(--surface)", borderRadius: 16, boxShadow: "var(--shadow-lg)", border: "0.5px solid var(--border-2)", overflow: "hidden" }}
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-2 border-b px-4" style={{ borderColor: "var(--border)" }}>
          <Search size={17} className="text-ink-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === "Enter") { e.preventDefault(); go(); }
            }}
            placeholder="Search clients, pages, actions…"
            className="w-full bg-transparent py-3.5 text-sm outline-none placeholder:text-ink-4"
          />
          <kbd className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-3">esc</kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto" }} className="py-1.5">
          {results.length === 0 && <div className="px-4 py-6 text-center text-sm text-ink-3">No matches for “{q}”.</div>}
          {results.map((i, idx) => {
            const showGroup = i.group !== lastGroup;
            lastGroup = i.group;
            const active = idx === sel;
            return (
              <div key={i.id}>
                {showGroup && <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-ink-4">{i.group}</div>}
                <button
                  onMouseEnter={() => setSel(idx)}
                  onClick={() => go(i)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left"
                  style={{ background: active ? "var(--accent-50)" : "transparent" }}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: active ? "var(--accent-100)" : "var(--surface-3)" }}>
                    <i.icon size={15} className={active ? "text-accent-700" : "text-ink-2"} />
                  </span>
                  <span className="flex-1 text-sm text-ink">{i.label}</span>
                  {i.sub && <span className="text-xs text-ink-3 tnum">{i.sub}</span>}
                  {active && <CornerDownLeft size={13} className="text-ink-3" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
