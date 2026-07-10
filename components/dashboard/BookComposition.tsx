"use client";

import { Section } from "./Section";
import { inr } from "@/lib/format";
import { PieChart } from "lucide-react";

type Seg = { label: string; count: number; premium: number };
const LINE_COLOR: Record<string, string> = { term: "var(--accent)", life: "var(--violet)", health: "var(--emerald)", motor: "var(--amber)" };
const COLORS = ["var(--accent)", "var(--emerald)", "var(--amber)", "var(--violet)", "var(--red)"];

export function BookComposition({ byLine, total }: { byLine: Seg[]; total: number }) {
  const size = 108, stroke = 16, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <Section title="Book composition" icon={<PieChart size={15} />} href="/policies" hrefLabel="Policies">
      <div className="flex items-center gap-4 pt-1">
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
          {byLine.map((s, i) => {
            const frac = s.count / (total || 1);
            const dash = frac * c;
            const seg = (
              <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={LINE_COLOR[s.label] ?? COLORS[i % COLORS.length]} strokeWidth={stroke}
                strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-acc * c}
                style={{ transition: "stroke-dasharray .9s ease" }} />
            );
            acc += frac;
            return seg;
          })}
        </svg>
        <div className="flex-1 space-y-1.5">
          {byLine.map((s, i) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LINE_COLOR[s.label] ?? COLORS[i % COLORS.length] }} />
              <span className="flex-1 capitalize text-ink-2">{s.label}</span>
              <span className="font-medium text-ink tnum">{s.count}</span>
              <span className="w-20 text-right text-ink-3 tnum">{inr(s.premium)}</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
