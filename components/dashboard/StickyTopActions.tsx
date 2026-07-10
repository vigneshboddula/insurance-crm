"use client";

import { useState } from "react";
import { waLink, telLink } from "@/lib/links";
import { MessageCircle, Phone, ChevronUp, Zap } from "lucide-react";

type Action = { id: string; title: string; reason: string; phone?: string; tone: "red" | "amber" | "accent" | "green"; priority: number };
const ring: Record<string, string> = { red: "var(--red)", amber: "var(--amber)", accent: "var(--accent)", green: "var(--emerald)" };

export function StickyTopActions({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);
  const top = actions.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <>
      {/* spacer so the fixed bar doesn't cover content */}
      <div className="h-20 md:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface/95 backdrop-blur md:hidden" style={{ borderColor: "var(--border)" }}>
        {open && (
          <div className="space-y-1.5 px-3 pt-2.5">
            {top.map((a, i) => (
              <div key={a.id} className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white" style={{ background: ring[a.tone] }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-ink">{a.title}</div>
                </div>
                {a.phone && (
                  <a href={waLink(a.phone)} target="_blank" rel="noopener" className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label="WhatsApp"><MessageCircle size={13} /></a>
                )}
                {a.phone && (
                  <a href={telLink(a.phone)} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ border: "0.5px solid var(--border-2)" }} aria-label="Call"><Phone size={12} className="text-ink-2" /></a>
                )}
              </div>
            ))}
          </div>
        )}
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2.5">
          <Zap size={15} style={{ color: ring[top[0].tone] }} />
          <span className="min-w-0 flex-1 truncate text-left text-xs font-medium text-ink">
            {open ? "Top 3 moves" : `Next: ${top[0].title}`}
          </span>
          <ChevronUp size={15} className="text-ink-3" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>
      </div>
    </>
  );
}
