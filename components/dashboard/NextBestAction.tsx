"use client";

import { waLink, telLink } from "@/lib/links";
import { Zap, MessageCircle, Phone } from "lucide-react";

type Action = { title: string; reason: string; phone?: string; priority: number; meta: string } | null;

export function NextBestAction({ action }: { action: Action }) {
  if (!action) return null;
  return (
    <div className="card flex items-center gap-3 p-3.5" style={{ background: "var(--ink)", borderColor: "transparent" }}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "rgba(255,255,255,0.12)" }}>
        <Zap size={18} className="text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.55)" }}>Next best action</span>
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold tnum" style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}>priority {action.priority}</span>
        </div>
        <div className="truncate text-sm font-semibold text-white">{action.title}</div>
        <div className="truncate text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>{action.reason}</div>
      </div>
      {action.phone && (
        <div className="flex shrink-0 items-center gap-1.5">
          <a href={waLink(action.phone)} target="_blank" rel="noopener" className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label="Send WhatsApp">
            <MessageCircle size={16} />
          </a>
          <a href={telLink(action.phone)} className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.12)" }} aria-label="Call">
            <Phone size={15} className="text-white" />
          </a>
        </div>
      )}
    </div>
  );
}
