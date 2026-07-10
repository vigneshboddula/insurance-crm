"use client";

import { Section } from "./Section";
import { waLink, telLink } from "@/lib/links";
import { MessageCircle, Phone, ListChecks } from "lucide-react";

type Action = {
  id: string; title: string; reason: string; clientId?: string; phone?: string;
  kind: "whatsapp" | "call" | "log"; tone: "red" | "amber" | "accent" | "green"; meta: string; priority: number;
};
const ring: Record<string, string> = { red: "var(--red)", amber: "var(--amber)", accent: "var(--accent)", green: "var(--emerald)" };

export function SmartActions({ actions }: { actions: Action[] }) {
  return (
    <Section title="Your top moves today" icon={<ListChecks size={15} />} preview>
      <ol className="space-y-1.5">
        {actions.map((a, i) => (
          <li key={a.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-semibold text-white tnum" style={{ background: ring[a.tone] }}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{a.title}</div>
              <div className="truncate text-[11px] text-ink-3"><span className="font-medium" style={{ color: ring[a.tone] }}>Why:</span> {a.reason}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="mr-0.5 hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold tnum sm:inline" style={{ background: "var(--surface-3)", color: ring[a.tone] }} title="Priority score">
                {a.priority}
              </span>
              {a.phone && (
                <a href={waLink(a.phone, `Hi, this is Vignesh.`)} target="_blank" rel="noopener" className="flex h-8 w-8 items-center justify-center rounded-lg text-white transition hover:opacity-90" style={{ background: "var(--emerald)" }} aria-label="Send WhatsApp" title="Send WhatsApp">
                  <MessageCircle size={15} />
                </a>
              )}
              {a.phone && (
                <a href={telLink(a.phone)} className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-surface-3" style={{ border: "0.5px solid var(--border-2)" }} aria-label="Call" title="Call / log">
                  <Phone size={14} className="text-ink-2" />
                </a>
              )}
            </div>
          </li>
        ))}
        {actions.length === 0 && <li className="py-6 text-center text-sm text-ink-3">All clear — nothing urgent right now. Enjoy the calm. ☕</li>}
      </ol>
    </Section>
  );
}
