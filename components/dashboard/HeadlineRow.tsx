"use client";

import { useState } from "react";
import Link from "next/link";
import { IndianRupee, UserPlus, PhoneCall, Bell, Stethoscope, BarChart3, ArrowUpRight } from "lucide-react";
import { inr } from "@/lib/format";

type Headline = {
  premium: { day: number; month: number; ytd: number; underMgmt: number };
  newLeadsMonth: number;
  leadActions: number;
  renewalsDue: number;
  claimsOpen: number;
};

const WINDOWS = [
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "ytd", label: "YTD" },
] as const;

export function HeadlineRow({ h }: { h: Headline }) {
  const [win, setWin] = useState<"day" | "month" | "ytd">("month");

  const Kpi = ({ icon: Icon, label, value, href, tone }: { icon: React.ElementType; label: string; value: string; href: string; tone: string }) => (
    <Link href={href} className="card card-hover group flex flex-col justify-between p-3.5">
      <div className="flex items-center justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${tone}1a` }}><Icon size={15} style={{ color: tone }} /></span>
        <ArrowUpRight size={14} className="text-ink-4 opacity-0 transition group-hover:opacity-100" />
      </div>
      <div className="mt-2">
        <div className="text-xl font-semibold tnum text-ink">{value}</div>
        <div className="text-[11px] text-ink-3">{label}</div>
      </div>
    </Link>
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
      {/* Total premium — the focal card */}
      <div className="card col-span-2 flex flex-col justify-between p-4" style={{ background: "var(--accent-50)", borderColor: "transparent" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--accent-700)" }}>
            <IndianRupee size={13} /> Total Premium
          </div>
          <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface)" }}>
            {WINDOWS.map((w) => (
              <button key={w.key} onClick={() => setWin(w.key)} className="rounded-md px-2 py-0.5 text-[11px] font-medium transition" style={win === w.key ? { background: "var(--accent)", color: "#fff" } : { color: "var(--ink-3)" }}>{w.label}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-3xl font-semibold tracking-tight tnum text-ink">{inr(h.premium[win])}</div>
          <div className="mt-0.5 text-[11px] text-ink-3">{win === "day" ? "secured today" : win === "month" ? "secured this month" : "secured this year"} · {inr(h.premium.underMgmt)} under management</div>
        </div>
      </div>

      <Kpi icon={UserPlus} label="New Leads" value={String(h.newLeadsMonth)} href="/leads" tone="var(--accent)" />
      <Kpi icon={PhoneCall} label="Lead Actions" value={String(h.leadActions)} href="/leads" tone="var(--amber-700)" />
      <Kpi icon={Bell} label="Renewals Due" value={String(h.renewalsDue)} href="/renewals" tone="var(--emerald)" />
      <Kpi icon={Stethoscope} label="Open Claims" value={String(h.claimsOpen)} href="/claims" tone="var(--red)" />
    </div>
  );
}

export function BusinessDashboardButton() {
  return (
    <a href="#business-pulse" className="btn"><BarChart3 size={14} style={{ color: "var(--accent-700)" }} /> Business Dashboard</a>
  );
}
