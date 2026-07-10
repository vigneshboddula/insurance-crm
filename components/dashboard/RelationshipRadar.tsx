"use client";

import { Section } from "./Section";
import { waLink } from "@/lib/links";
import { HeartHandshake, MessageCircle } from "lucide-react";

type Item = { type: "birthday" | "anniversary" | "festival"; label: string; sub: string; days: number; clientId?: string; phone?: string; emoji: string; greeting?: string };

export function RelationshipRadar({ items }: { items: Item[] }) {
  return (
    <Section title="Relationship radar" icon={<HeartHandshake size={15} />}>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-surface-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base" style={{ background: "var(--surface-3)" }}>{it.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{it.label}</div>
              <div className="truncate text-[11px] text-ink-3">{it.sub}</div>
            </div>
            <span className="pill-gray pill shrink-0">{it.days === 0 ? "today" : `${it.days}d`}</span>
            {it.phone && (
              <a href={waLink(it.phone, `${it.greeting}, ${it.label}! — Vignesh`)} target="_blank" rel="noopener" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label="Send greeting">
                <MessageCircle size={13} />
              </a>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="py-5 text-center text-sm text-ink-3">No upcoming occasions in the next month.</li>}
      </ul>
    </Section>
  );
}
