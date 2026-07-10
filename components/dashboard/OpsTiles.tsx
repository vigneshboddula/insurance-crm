"use client";

import Link from "next/link";
import { Section } from "./Section";
import { CountUp } from "./primitives";
import { inr } from "@/lib/format";
import { Gauge, Bell, Wallet, BadgeIndianRupee, FileWarning, FileX2, Inbox } from "lucide-react";

type Ops = {
  renewalsDueMonth: number; premiumExpected: number; premiumCollected: number;
  missingNotice: number; missingCopy: number; unmatchedDocs: number; reviewQueue: number;
};

function Tile({ icon: Icon, label, children, tone = "ink", href }: { icon: React.ElementType; label: string; children: React.ReactNode; tone?: "ink" | "red" | "amber" | "green"; href?: string }) {
  const color = tone === "red" ? "var(--red)" : tone === "amber" ? "var(--amber-700)" : tone === "green" ? "var(--emerald-700)" : "var(--ink)";
  const body = (
    <div className="rounded-xl p-3 transition hover:bg-surface-3" style={{ background: "var(--surface-2)" }}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-ink-3"><Icon size={13} /> {label}</div>
      <div className="text-xl font-semibold" style={{ color }}>{children}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function OpsTiles({ ops }: { ops: Ops }) {
  return (
    <Section title="Operations · this month" icon={<Gauge size={15} />}>
      <div className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3 lg:grid-cols-6">
        <Tile icon={Bell} label="Renewals due" href="/renewals"><CountUp value={ops.renewalsDueMonth} /></Tile>
        <Tile icon={Wallet} label="Premium expected"><CountUp value={ops.premiumExpected} format={inr} /></Tile>
        <Tile icon={BadgeIndianRupee} label="Premium collected" tone="green"><CountUp value={ops.premiumCollected} format={inr} /></Tile>
        <Tile icon={FileWarning} label="Missing notice" tone={ops.missingNotice ? "amber" : "green"} href="/renewals"><CountUp value={ops.missingNotice} /></Tile>
        <Tile icon={FileX2} label="Missing copy" tone={ops.missingCopy ? "amber" : "green"} href="/policies"><CountUp value={ops.missingCopy} /></Tile>
      </div>
    </Section>
  );
}
