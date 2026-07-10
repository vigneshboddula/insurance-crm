"use client";

import { CountUp } from "./primitives";
import { inr } from "@/lib/format";
import { Users, FileText, Wallet, BadgeIndianRupee, AlertCircle, CalendarClock, CalendarDays, Flame } from "lucide-react";

type Kpis = {
  clients: number; activePolicies: number; premiumUnderMgmt: number; commissionReceived: number;
  overdue: number; dueThisWeek: number; dueThisMonth: number; openLeads: number; openTasks: number;
};

function Card({ label, icon: Icon, children, tone = "ink" }: { label: string; icon: React.ElementType; children: React.ReactNode; tone?: "ink" | "red" | "amber" | "green" }) {
  const color = tone === "red" ? "var(--red)" : tone === "amber" ? "var(--amber)" : tone === "green" ? "var(--emerald)" : "var(--ink)";
  return (
    <div className="card card-hover p-3.5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3">
        <Icon size={13} /> {label}
      </div>
      <div className="text-[26px] font-semibold leading-none" style={{ color }}>{children}</div>
    </div>
  );
}

export function KpiRow({ k }: { k: Kpis }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Clients" icon={Users}><CountUp value={k.clients} /></Card>
        <Card label="Active policies" icon={FileText}><CountUp value={k.activePolicies} /></Card>
        <Card label="Premium under mgmt" icon={Wallet}><CountUp value={k.premiumUnderMgmt} format={inr} /></Card>
        <Card label="Commission received" icon={BadgeIndianRupee} tone="green"><CountUp value={k.commissionReceived} format={inr} /></Card>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Overdue" icon={AlertCircle} tone={k.overdue ? "red" : "green"}><CountUp value={k.overdue} /></Card>
        <Card label="Due this week" icon={CalendarClock} tone={k.dueThisWeek ? "amber" : "green"}><CountUp value={k.dueThisWeek} /></Card>
        <Card label="Due this month" icon={CalendarDays} tone={k.dueThisMonth ? "amber" : "green"}><CountUp value={k.dueThisMonth} /></Card>
        <Card label="Open leads / tasks" icon={Flame}>
          <span><CountUp value={k.openLeads} /> <span className="text-ink-4">/</span> <CountUp value={k.openTasks} /></span>
        </Card>
      </div>
    </div>
  );
}
