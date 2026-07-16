"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Crown, Medal, Award, Circle, ArrowLeftRight, MessageCircle,
  Users, TrendingUp, Search, ChevronDown, Filter,
} from "lucide-react";
import { inr } from "@/lib/format";
import { waLink } from "@/lib/links";
import type { TieredClient, TierSummary, CrossSellOpportunity, CrossSellSummary, ReferralStats, Tier } from "@/lib/growth";

// ── Tier badge ──

const TIER_META: Record<Tier, { label: string; icon: typeof Crown; bg: string; color: string }> = {
  platinum: { label: "Platinum", icon: Crown, bg: "var(--accent-50)", color: "var(--accent-700)" },
  gold: { label: "Gold", icon: Medal, bg: "var(--amber-50)", color: "var(--amber-700)" },
  silver: { label: "Silver", icon: Award, bg: "var(--surface-3)", color: "var(--ink-2)" },
  bronze: { label: "Bronze", icon: Circle, bg: "var(--surface-2)", color: "var(--ink-3)" },
};

function TierBadge({ tier }: { tier: Tier }) {
  const m = TIER_META[tier];
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: m.bg, color: m.color }}>
      <Icon size={11} /> {m.label}
    </span>
  );
}

// ── Main component ──

type Props = {
  clients: TieredClient[];
  tierSummary: TierSummary;
  crossSell: CrossSellOpportunity[];
  crossSellSummary: CrossSellSummary;
  referralStats: ReferralStats;
};

export function GrowthDashboard({ clients, tierSummary, crossSell, crossSellSummary, referralStats }: Props) {
  return (
    <div className="space-y-4">
      <TierOverview clients={clients} summary={tierSummary} />
      <CrossSellPipeline items={crossSell} summary={crossSellSummary} />
      <ReferralPanel stats={referralStats} />
    </div>
  );
}

// ── Tier overview ──

function TierOverview({ clients, summary }: { clients: TieredClient[]; summary: TierSummary }) {
  const [filter, setFilter] = useState<Tier | "all">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(true);

  const filtered = clients.filter((c) => {
    if (filter !== "all" && c.tier !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
    }
    return true;
  });

  const chips: { key: Tier | "all"; label: string; count: number }[] = [
    { key: "all", label: "All", count: summary.totalClients },
    { key: "platinum", label: "Platinum", count: summary.platinum },
    { key: "gold", label: "Gold", count: summary.gold },
    { key: "silver", label: "Silver", count: summary.silver },
    { key: "bronze", label: "Bronze", count: summary.bronze },
  ];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5 pb-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Crown size={15} className="text-ink-3" /> Client tiers
        </h2>
        <span className="text-[11px] text-ink-3">
          {summary.totalClients} clients · {inr(summary.totalPremium)} AUM
        </span>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-4 gap-3 px-4 pb-3">
        {(["platinum", "gold", "silver", "bronze"] as Tier[]).map((t) => {
          const m = TIER_META[t];
          const count = summary[t];
          const prem = clients.filter((c) => c.tier === t).reduce((s, c) => s + c.totalPremium, 0);
          return (
            <button key={t} onClick={() => setFilter(filter === t ? "all" : t)} className="rounded-xl p-3 text-left transition hover:ring-1" style={{ background: m.bg, ...(filter === t ? { ring: `2px solid ${m.color}` } : {}) }}>
              <div className="text-xl font-semibold tnum" style={{ color: m.color }}>{count}</div>
              <div className="text-[11px]" style={{ color: m.color }}>{m.label} · {inr(prem)}</div>
            </button>
          );
        })}
      </div>

      {/* Toggle detail */}
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-sm text-ink-2 hover:bg-surface-2 transition" style={{ borderColor: "var(--border)" }}>
        <Users size={13} /> Client list
        <ChevronDown size={14} className={`ml-auto transition ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="w-full rounded-lg border py-1.5 pl-8 pr-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
            </div>
            {chips.map((c) => (
              <button key={c.key} onClick={() => setFilter(c.key)} className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${filter === c.key ? "bg-indigo-600 text-white" : "text-ink-2 hover:bg-surface-3"}`}>
                {c.label} <span className="tnum">{c.count}</span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-[11px] text-ink-3" style={{ borderColor: "var(--border)" }}>
                  <th className="pb-1.5 text-left font-medium">Client</th>
                  <th className="pb-1.5 text-center font-medium">Tier</th>
                  <th className="pb-1.5 text-right font-medium">Premium</th>
                  <th className="pb-1.5 text-right font-medium">Policies</th>
                  <th className="pb-1.5 text-left font-medium">Lines</th>
                  <th className="pb-1.5 text-left font-medium">Gap</th>
                  <th className="pb-1.5 text-right font-medium">Tenure</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 80).map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-surface-2 transition" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 pr-3">
                      <Link href={`/clients/${c.id}`} className="font-medium text-ink hover:text-indigo-600 transition">{c.name}</Link>
                    </td>
                    <td className="py-2 text-center"><TierBadge tier={c.tier} /></td>
                    <td className="py-2 pr-3 text-right tnum">{inr(c.totalPremium)}</td>
                    <td className="py-2 pr-3 text-right tnum">{c.activePolicies}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">{c.lines.map((l) => <span key={l} className="pill pill-gray capitalize">{l}</span>)}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {c.crossSellGap ? <span className="pill pill-amber capitalize">{c.crossSellGap}</span> : <span className="text-ink-3 text-[11px]">—</span>}
                    </td>
                    <td className="py-2 text-right text-ink-3 tnum">{c.tenureMonths}mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="py-4 text-center text-sm text-ink-3">No clients match this filter.</p>}
            {filtered.length > 80 && <p className="py-2 text-center text-[11px] text-ink-3">Showing first 80 of {filtered.length}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Cross-sell pipeline ──

function CrossSellPipeline({ items, summary }: { items: CrossSellOpportunity[]; summary: CrossSellSummary }) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? items : items.filter((it) => it.recommend === filter);
  const lineChips = [
    { key: "all", label: "All", count: summary.totalOpportunities },
    ...summary.byRecommendation.map((r) => ({ key: r.line, label: r.line, count: r.count })),
  ];

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5 pb-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <ArrowLeftRight size={15} className="text-ink-3" /> Cross-sell pipeline
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-3 px-4 pb-3">
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-[11px] text-ink-3">Opportunities</div>
          <div className="text-lg font-semibold tnum text-ink">{summary.totalOpportunities}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-[11px] text-ink-3">Est. new premium</div>
          <div className="text-lg font-semibold tnum" style={{ color: "var(--emerald-700)" }}>{inr(summary.totalEstPremium)}</div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="text-[11px] text-ink-3">Est. commission</div>
          <div className="text-lg font-semibold tnum" style={{ color: "var(--emerald-700)" }}>{inr(summary.totalEstCommission)}</div>
        </div>
      </div>

      <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="mb-3 flex flex-wrap gap-2">
          {lineChips.map((c) => (
            <button key={c.key} onClick={() => setFilter(c.key)} className={`rounded-full px-3 py-1 text-[11px] font-medium capitalize transition ${filter === c.key ? "bg-indigo-600 text-white" : "text-ink-2 hover:bg-surface-3"}`}>
              {c.label} <span className="tnum">{c.count}</span>
            </button>
          ))}
        </div>

        <ul className="space-y-1">
          {filtered.slice(0, 50).map((it) => (
            <li key={`${it.clientId}-${it.recommend}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2 transition">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={`/clients/${it.clientId}`} className="truncate text-sm font-medium text-ink hover:text-indigo-600 transition">{it.name}</Link>
                  <TierBadge tier={it.tier} />
                  <span className="text-[11px] text-ink-3">has</span>
                  {it.has.map((l) => <span key={l} className="pill pill-gray capitalize">{l}</span>)}
                </div>
                <div className="truncate text-[11px] text-ink-3">{it.reason}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs font-medium text-ink">
                  add <span className="capitalize" style={{ color: "var(--accent-700)" }}>{it.recommend}</span>
                </div>
                <div className="text-[10px] text-ink-3 tnum">{inr(it.estPremium)} · ≈{inr(it.estCommission)} comm.</div>
              </div>
              <a href={waLink(it.phone, `Hi ${it.name}, I wanted to discuss a ${it.recommend} option that could complement your existing coverage.`)} target="_blank" rel="noopener" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "var(--emerald)" }} aria-label={`WhatsApp ${it.name}`}>
                <MessageCircle size={13} />
              </a>
            </li>
          ))}
          {filtered.length === 0 && <li className="py-5 text-center text-sm text-ink-3">No cross-sell gaps found.</li>}
        </ul>
      </div>
    </section>
  );
}

// ── Referral stats ──

function ReferralPanel({ stats }: { stats: ReferralStats }) {
  const maxCount = Math.max(...stats.bySource.map((s) => s.count), 1);

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3.5 pb-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <TrendingUp size={15} className="text-ink-3" /> Lead sources & referrals
        </h2>
        <span className="text-[11px] text-ink-3">{stats.totalLeads} total leads</span>
      </div>

      <div className="px-4 pb-4 space-y-2">
        {stats.bySource.map((s) => (
          <div key={s.source} className="flex items-center gap-3">
            <span className="w-20 text-sm font-medium text-ink capitalize">{s.source}</span>
            <div className="flex-1 h-6 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
              <div className="h-full rounded-full flex items-center px-2 text-[11px] font-medium text-white transition-all" style={{ width: `${Math.max(8, (s.count / maxCount) * 100)}%`, background: s.source === "referral" ? "var(--emerald)" : "var(--accent)" }}>
                {s.count}
              </div>
            </div>
            <div className="w-20 text-right">
              <span className="text-[11px] text-ink-3">{s.wonCount} won</span>
              {s.conversionRate > 0 && <span className="ml-1 text-[11px] font-medium" style={{ color: "var(--emerald-700)" }}>{s.conversionRate}%</span>}
            </div>
          </div>
        ))}
        {stats.bySource.length === 0 && <p className="py-4 text-center text-sm text-ink-3">No leads yet — add leads to see source analytics.</p>}
      </div>
    </section>
  );
}
