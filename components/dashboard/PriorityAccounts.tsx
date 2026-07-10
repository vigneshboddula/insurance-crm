"use client";

import { Section } from "./Section";
import { waLink } from "@/lib/links";
import { Crosshair, MessageCircle } from "lucide-react";

type PA = { id: string; name: string; phone?: string; score: number; premiumAtRisk: number; overdueAge: number; quoteValue: number; tags: string[] };

function tone(score: number) {
  if (score >= 70) return { bg: "var(--red-50)", c: "var(--red-700)" };
  if (score >= 40) return { bg: "var(--amber-50)", c: "var(--amber-700)" };
  return { bg: "var(--accent-50)", c: "var(--accent-700)" };
}

export function PriorityAccounts({ accounts }: { accounts: PA[] }) {
  return (
    <Section title="Priority accounts" icon={<Crosshair size={15} />} preview>
      <ul className="space-y-1.5">
        {accounts.map((a) => {
          const t = tone(a.score);
          return (
            <li key={a.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2">
              <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg tnum" style={{ background: t.bg, color: t.c }}>
                <span className="text-sm font-semibold leading-none">{a.score}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{a.name}</div>
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {a.tags.map((tg, i) => (
                    <span key={i} className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: "var(--surface-3)", color: "var(--ink-2)" }}>{tg}</span>
                  ))}
                </div>
              </div>
              {a.phone && (
                <a href={waLink(a.phone)} target="_blank" rel="noopener" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label={`WhatsApp ${a.name}`}>
                  <MessageCircle size={13} />
                </a>
              )}
            </li>
          );
        })}
        {accounts.length === 0 && <li className="py-5 text-center text-sm text-ink-3">No priority accounts in this window.</li>}
      </ul>
    </Section>
  );
}
