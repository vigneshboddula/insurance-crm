"use client";

import { Section } from "./Section";
import { inr } from "@/lib/format";
import { Filter } from "lucide-react";

type Stage = { stage: string; count: number; value: number };
const COLOR: Record<string, string> = { New: "var(--ink-4)", Contacted: "var(--accent)", Quoted: "var(--violet)", Won: "var(--emerald)", Lost: "var(--ink-3)" };

export function PipelineFunnel({ stages }: { stages: Stage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <Section title="Pipeline" icon={<Filter size={15} />} href="/leads" hrefLabel="Leads">
      <div className="space-y-2 pt-1">
        {stages.map((s) => (
          <div key={s.stage} className="flex items-center gap-3">
            <div className="w-20 shrink-0 text-xs font-medium text-ink-2">{s.stage}</div>
            <div className="flex-1">
              <div className="flex h-7 items-center rounded-lg px-2 transition-all" style={{ width: `${Math.max(12, (s.count / max) * 100)}%`, minWidth: 40, background: COLOR[s.stage] ?? "var(--accent)" }}>
                <span className="text-xs font-semibold text-white tnum">{s.count}</span>
              </div>
            </div>
            <div className="w-20 shrink-0 text-right text-[11px] text-ink-3 tnum">{s.value > 0 ? inr(s.value) : "—"}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}
