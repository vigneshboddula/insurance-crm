"use client";

import { CountUp, Bar } from "./primitives";
import { inr } from "@/lib/format";
import { Flag, Sparkle } from "lucide-react";

export function GoalMomentum({ premiumTarget, premiumAchieved, premiumProjected, commissionTarget, commissionAchieved, bookLifetimeValue }: {
  premiumTarget: number; premiumAchieved: number; premiumProjected: number;
  commissionTarget: number; commissionAchieved: number; bookLifetimeValue: number;
}) {
  const pPct = Math.round((premiumAchieved / premiumTarget) * 100);
  const projPct = Math.round((premiumProjected / premiumTarget) * 100);
  const cPct = Math.round((commissionAchieved / commissionTarget) * 100);

  return (
    <section className="card card-hover h-full">
      <div className="flex items-center gap-2 px-5 pb-1 pt-3.5">
        <Flag size={14} className="text-ink-3" />
        <h2 className="text-[13px] font-semibold text-ink">Goal &amp; momentum</h2>
        <span className="pill-gray pill ml-auto">this month</span>
      </div>
      <div className="space-y-3.5 px-5 pb-4 pt-1">
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs text-ink-2">Premium</span>
            <span className="text-xs text-ink-3 tnum"><span className="font-semibold text-ink">{inr(premiumAchieved)}</span> / {inr(premiumTarget)}</span>
          </div>
          <Bar pct={pPct} color="var(--accent)" />
          <div className="mt-1 text-[11px] text-ink-3">
            <Sparkle size={11} className="mr-1 inline" style={{ color: "var(--accent)" }} />
            Close this week&apos;s renewals → on track for <span className="font-medium text-ink">{inr(premiumProjected)}</span> ({projPct}%)
          </div>
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs text-ink-2">Commission</span>
            <span className="text-xs text-ink-3 tnum"><span className="font-semibold text-ink">{inr(commissionAchieved)}</span> / {inr(commissionTarget)}</span>
          </div>
          <Bar pct={cPct} color="var(--emerald)" />
        </div>
        <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--surface-3)" }}>
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-3">Book lifetime value</div>
          <div className="text-xl font-semibold" style={{ color: "var(--emerald-700)" }}>
            <CountUp value={bookLifetimeValue} format={inr} />
          </div>
          <div className="text-[10px] text-ink-4">Expected commission from your active book</div>
        </div>
      </div>
    </section>
  );
}
