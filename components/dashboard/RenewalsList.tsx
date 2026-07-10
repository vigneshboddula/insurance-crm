"use client";

import { Section } from "./Section";
import { inr, fmtDate } from "@/lib/format";
import { waLink } from "@/lib/links";
import { Bell, MessageCircle } from "lucide-react";

type Item = { id: string; clientId: string; name: string; phone: string; carrier: string; line: string; policyNumber: string; premium: number; renewalDate: string; days: number };

export function RenewalsList({ items }: { items: Item[] }) {
  return (
    <Section title="Upcoming & overdue renewals" icon={<Bell size={15} />} href="/renewals">
      <ul className="-mx-1 divide-y" style={{ borderColor: "var(--border)" }}>
        {items.map((p) => {
          const tone = p.days < 0 ? { bg: "var(--red-50)", c: "var(--red-700)", label: `Overdue ${Math.abs(p.days)}d` } : p.days <= 14 ? { bg: "var(--amber-50)", c: "var(--amber-700)", label: p.days === 0 ? "Due today" : `In ${p.days}d` } : { bg: "var(--emerald-50)", c: "var(--emerald-700)", label: `In ${p.days}d` };
          return (
            <li key={p.id} className="flex items-center gap-3 px-1 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                <div className="truncate text-[11px] text-ink-3">{p.carrier} · {p.line.toUpperCase()} · {p.policyNumber}</div>
              </div>
              <span className="hidden text-sm text-ink-2 tnum sm:inline">{inr(p.premium)}</span>
              <span className="hidden text-xs text-ink-3 tnum md:inline">{fmtDate(p.renewalDate)}</span>
              <span className="pill w-[78px] justify-center" style={{ background: tone.bg, color: tone.c }}>{tone.label}</span>
              <a href={waLink(p.phone, `Hi ${p.name}, your ${p.carrier} policy ${p.policyNumber} is due for renewal on ${fmtDate(p.renewalDate)} (premium ${inr(p.premium)}). Shall I help you renew?`)} target="_blank" rel="noopener" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label={`WhatsApp ${p.name}`}>
                <MessageCircle size={13} />
              </a>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
