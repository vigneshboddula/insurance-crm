"use client";

import { Section } from "./Section";
import { waLink } from "@/lib/links";
import { Radar, MessageCircle } from "lucide-react";

type Item = { clientId: string; name: string; phone: string; level: "high" | "medium" | "low"; score: number; reason: string };
const tone: Record<string, { bg: string; c: string }> = {
  high: { bg: "var(--red-50)", c: "var(--red-700)" },
  medium: { bg: "var(--amber-50)", c: "var(--amber-700)" },
  low: { bg: "var(--surface-3)", c: "var(--ink-2)" },
};

export function LapseRadar({ items }: { items: Item[] }) {
  return (
    <Section title="Lapse-risk radar" icon={<Radar size={15} />} preview>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.clientId} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-surface-2">
            <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: tone[it.level].c }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-ink">{it.name}</span>
                <span className="pill" style={{ background: tone[it.level].bg, color: tone[it.level].c }}>{it.level}</span>
              </div>
              <div className="truncate text-[11px] text-ink-3">{it.reason}</div>
            </div>
            <a href={waLink(it.phone, `Hi ${it.name}, just checking in from Vignesh — is everything okay with your policy?`)} target="_blank" rel="noopener" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label={`WhatsApp ${it.name}`}>
              <MessageCircle size={13} />
            </a>
          </li>
        ))}
        {items.length === 0 && <li className="py-5 text-center text-sm text-ink-3">No lapse risks detected. 🎉</li>}
      </ul>
    </Section>
  );
}
