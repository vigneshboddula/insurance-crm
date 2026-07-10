"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Check } from "lucide-react";

type RingDef = { label: string; value: number; goal: number; color: string };

export function ActivityRings({ streak, rings }: { streak: number; rings: RingDef[] }) {
  const [on, setOn] = useState(false);
  const fired = useRef(false);
  const size = 132;
  const stroke = 11;
  const gap = 4;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setOn(true);
    const closed = rings.some((r) => r.value >= r.goal);
    if (closed && !fired.current && !reduce) {
      fired.current = true;
      import("canvas-confetti").then(({ default: confetti }) => {
        setTimeout(() => confetti({ particleCount: 70, spread: 60, origin: { y: 0.4 }, scalar: 0.8, colors: ["#0e9f6e", "#4f46e5", "#e8930c"] }), 900);
      });
    }
  }, [rings]);

  return (
    <section className="card card-hover h-full">
      <div className="flex items-center justify-between px-5 pb-1 pt-3.5">
        <h2 className="text-[13px] font-semibold text-ink">Today&apos;s activity</h2>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: "var(--amber-50)", color: "var(--amber-700)" }}>
          <Flame size={13} /> {streak}-day streak
        </span>
      </div>
      <div className="flex items-center gap-4 px-5 pb-4 pt-1">
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
          {rings.map((r, i) => {
            const radius = (size - stroke) / 2 - i * (stroke + gap);
            const c = 2 * Math.PI * radius;
            const pct = Math.min(1, r.value / r.goal);
            return (
              <g key={r.label}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeOpacity={0.16} strokeWidth={stroke} />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeWidth={stroke} strokeLinecap="round"
                  strokeDasharray={c} strokeDashoffset={on ? c * (1 - pct) : c}
                  style={{ transition: `stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1) ${i * 0.12}s` }} />
              </g>
            );
          })}
        </svg>
        <div className="flex-1 space-y-2">
          {rings.map((r) => {
            const done = r.value >= r.goal;
            return (
              <div key={r.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />
                <div className="flex-1">
                  <div className="text-xs font-medium text-ink">{r.label}</div>
                  <div className="text-[11px] text-ink-3 tnum">{r.value} / {r.goal}{done && <span className="ml-1" style={{ color: r.color }}><Check size={11} className="inline" /> done</span>}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
