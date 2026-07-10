"use client";

import { useState } from "react";
import { Ring, CountUp } from "./primitives";
import { Gauge, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";

type Sub = { label: string; score: number; weight: number; hint: string };

export function BusinessPulse({ score, sub, trendDelta }: { score: number; sub: Sub[]; trendDelta: number }) {
  const [open, setOpen] = useState(false);
  const band = score >= 80 ? { label: "Excellent", color: "var(--emerald)" } : score >= 60 ? { label: "Healthy", color: "var(--accent)" } : score >= 40 ? { label: "Needs care", color: "var(--amber)" } : { label: "At risk", color: "var(--red)" };
  const Trend = trendDelta > 0 ? TrendingUp : trendDelta < 0 ? TrendingDown : Minus;
  const trendColor = trendDelta > 0 ? "var(--emerald)" : trendDelta < 0 ? "var(--red)" : "var(--ink-3)";

  return (
    <section className="card card-hover h-full">
      <div className="flex items-center gap-2 px-5 pb-1 pt-3.5">
        <Gauge size={14} className="text-ink-3" />
        <h2 className="text-[13px] font-semibold text-ink">Business pulse</h2>
      </div>
      <div className="flex flex-col items-center px-5 pb-4">
        <Ring pct={score} size={150} stroke={13} color={band.color}>
          <div className="text-[40px] font-semibold leading-none" style={{ color: band.color }}>
            <CountUp value={score} />
          </div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">Book health</div>
        </Ring>
        <div className="mt-2 flex items-center gap-2">
          <span className="pill" style={{ background: "var(--surface-3)", color: band.color }}>{band.label}</span>
          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: trendColor }}>
            <Trend size={13} /> {trendDelta > 0 ? "+" : ""}{trendDelta} vs last month
          </span>
        </div>

        <button onClick={() => setOpen((o) => !o)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
          {open ? "Hide" : "See"} the 5 sub-scores <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>

        {open && (
          <div className="mt-3 w-full space-y-2.5 pop-in">
            {sub.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-2">{s.label}</span>
                  <span className="tnum font-medium text-ink">{s.score}</span>
                </div>
                <div style={{ background: "var(--surface-3)", borderRadius: 999, height: 6 }}>
                  <div style={{ width: `${s.score}%`, height: "100%", borderRadius: 999, background: s.score >= 70 ? "var(--emerald)" : s.score >= 45 ? "var(--accent)" : "var(--amber)" }} />
                </div>
                <div className="mt-0.5 text-[10px] text-ink-4">{s.hint}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
