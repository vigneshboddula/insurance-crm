"use client";

import { Section } from "./Section";
import { CountUp } from "./primitives";
import { inr } from "@/lib/format";
import { waLink } from "@/lib/links";
import { ArrowLeftRight, MessageCircle } from "lucide-react";

type Item = { clientId: string; name: string; has: string[]; recommend: string; estPremium: number; estCommission: number; reason: string };

export function CrossSell({ items, totalCommission }: { items: Item[]; totalCommission: number }) {
  return (
    <Section title="Cross-sell spotlight" icon={<ArrowLeftRight size={15} />} preview
      right={<span className="text-xs text-ink-3">worth <span className="font-semibold text-emerald-700" style={{ color: "var(--emerald-700)" }}><CountUp value={totalCommission} format={inr} /></span></span>}>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.clientId} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">
                {it.name} <span className="font-normal text-ink-3">· add</span> <span className="capitalize" style={{ color: "var(--accent-700)" }}>{it.recommend}</span>
              </div>
              <div className="truncate text-[11px] text-ink-3">{it.reason}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-semibold text-ink tnum">{inr(it.estPremium)}</div>
              <div className="text-[10px] text-ink-3">≈ {inr(it.estCommission)} comm.</div>
            </div>
            <a href={waLink("", `Hi ${it.name}, I noticed a gap in your cover — can I share a quick ${it.recommend} option?`)} target="_blank" rel="noopener" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label="Pitch on WhatsApp">
              <MessageCircle size={13} />
            </a>
          </li>
        ))}
        {items.length === 0 && <li className="py-5 text-center text-sm text-ink-3">No obvious gaps — your book is well-covered. 👍</li>}
      </ul>
    </Section>
  );
}
