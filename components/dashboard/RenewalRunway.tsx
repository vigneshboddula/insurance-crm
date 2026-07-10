"use client";

import { useState } from "react";
import { Section } from "./Section";
import { inr } from "@/lib/format";
import { CalendarRange } from "lucide-react";

type Week = { weekStart: string; label: string; count: number; premium: number };

export function RenewalRunway({ weeks, max }: { weeks: Week[]; max: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? weeks.findIndex((w) => w.count > 0);
  const sel = active >= 0 ? weeks[active] : null;

  return (
    <Section title="Renewal runway · next 90 days" icon={<CalendarRange size={15} />} href="/renewals" hrefLabel="Renewals">
      <div className="flex items-end gap-1.5 pt-1" style={{ height: 88 }}>
        {weeks.map((w, i) => {
          const intensity = w.count / max;
          const h = w.count === 0 ? 8 : 20 + intensity * 64;
          const bg = w.count === 0 ? "var(--surface-3)" : intensity > 0.66 ? "var(--red)" : intensity > 0.33 ? "var(--amber)" : "var(--accent)";
          return (
            <button key={w.weekStart} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              className="group relative flex-1 rounded-md transition" style={{ height: h, background: bg, opacity: hover === null || hover === i ? 1 : 0.45 }}
              aria-label={`Week of ${w.label}: ${w.count} renewals`}>
              {w.count > 0 && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-ink tnum">{w.count}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-ink-4">
        <span>{weeks[0]?.label}</span><span>+30d</span><span>+60d</span><span>{weeks[weeks.length - 1]?.label}</span>
      </div>
      {sel && (
        <div className="mt-2 rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface-3)" }}>
          <span className="font-medium text-ink">Week of {sel.label}:</span>{" "}
          <span className="text-ink-2">{sel.count} renewal{sel.count !== 1 ? "s" : ""} · {inr(sel.premium)} premium</span>
        </div>
      )}
    </Section>
  );
}
