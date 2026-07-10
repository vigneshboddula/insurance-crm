"use client";

import { Section } from "./Section";
import { CountUp } from "./primitives";
import { inr } from "@/lib/format";
import { Activity, Phone, ShieldCheck, FileSignature, TrendingUp } from "lucide-react";

type Perf = { rangeLabel: string; callsMade: number; renewalsSaved: number; quotesSent: number; premiumSecured: number };

function Tile({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-ink-3">
        <Icon size={13} /> {label}
      </div>
      <div className="text-xl font-semibold text-ink">{children}</div>
    </div>
  );
}

export function Performance({ p }: { p: Perf }) {
  return (
    <Section title={`Your scorecard · ${p.rangeLabel}`} icon={<Activity size={15} />}>
      <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-4">
        <Tile icon={Phone} label="Calls made"><CountUp value={p.callsMade} /></Tile>
        <Tile icon={ShieldCheck} label="Renewals saved"><CountUp value={p.renewalsSaved} /></Tile>
        <Tile icon={FileSignature} label="Quotes sent"><CountUp value={p.quotesSent} /></Tile>
        <Tile icon={TrendingUp} label="Premium secured"><CountUp value={p.premiumSecured} format={inr} /></Tile>
      </div>
    </Section>
  );
}
