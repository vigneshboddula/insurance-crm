import "server-only";
import { prisma } from "@/lib/db";

const DAY = 86_400_000;

// ── Client tiers ──
// Platinum: ≥₹1L premium OR ≥5 active policies
// Gold:     ≥₹50k OR ≥3 active policies
// Silver:   ≥₹20k OR ≥2 active policies
// Bronze:   everyone else

export type Tier = "platinum" | "gold" | "silver" | "bronze";

export type TieredClient = {
  id: string;
  name: string;
  phone: string;
  tier: Tier;
  totalPremium: number;
  activePolicies: number;
  lines: string[];
  tenureMonths: number;
  lastContact: string | null;
  crossSellGap: string | null;
};

export type TierSummary = {
  platinum: number;
  gold: number;
  silver: number;
  bronze: number;
  totalClients: number;
  totalPremium: number;
};

function computeTier(premium: number, policies: number): Tier {
  if (premium >= 100_000 || policies >= 5) return "platinum";
  if (premium >= 50_000 || policies >= 3) return "gold";
  if (premium >= 20_000 || policies >= 2) return "silver";
  return "bronze";
}

const LINES_ALL = ["term", "life", "health"];

function findGap(lines: Set<string>, age: number): string | null {
  if ((lines.has("term") || lines.has("life")) && !lines.has("health")) return "health";
  if (lines.has("health") && !lines.has("term") && !lines.has("life") && age < 55) return "term";
  if (lines.has("health") && lines.has("term") && !lines.has("life")) return "life";
  return null;
}

export async function getClientTiers(now = new Date()): Promise<{ clients: TieredClient[]; summary: TierSummary }> {
  const clients = await prisma.client.findMany({
    where: { archivedAt: null, deletedAt: null },
    include: {
      policies: {
        where: { deletedAt: null },
        select: { premium: true, status: true, line: true, startDate: true },
      },
      communications: {
        orderBy: { occurredAt: "desc" },
        take: 1,
        select: { occurredAt: true },
      },
    },
  });

  const result: TieredClient[] = [];

  for (const c of clients) {
    const active = c.policies.filter((p) => p.status === "active");
    const totalPremium = Math.round(active.reduce((s, p) => s + p.premium, 0));
    const lines = new Set(active.map((p) => p.line));
    const earliest = c.policies.reduce((min, p) => (p.startDate < min ? p.startDate : min), now);
    const tenureMonths = Math.max(0, Math.round((now.getTime() - earliest.getTime()) / (30 * DAY)));
    const age = c.dob ? now.getFullYear() - c.dob.getFullYear() : 40;
    const lastComm = c.communications[0]?.occurredAt ?? null;

    result.push({
      id: c.id,
      name: c.name,
      phone: c.phone || "",
      tier: computeTier(totalPremium, active.length),
      totalPremium,
      activePolicies: active.length,
      lines: [...lines],
      tenureMonths,
      lastContact: lastComm?.toISOString() ?? null,
      crossSellGap: findGap(lines, age),
    });
  }

  result.sort((a, b) => b.totalPremium - a.totalPremium);

  const summary: TierSummary = {
    platinum: result.filter((c) => c.tier === "platinum").length,
    gold: result.filter((c) => c.tier === "gold").length,
    silver: result.filter((c) => c.tier === "silver").length,
    bronze: result.filter((c) => c.tier === "bronze").length,
    totalClients: result.length,
    totalPremium: result.reduce((s, c) => s + c.totalPremium, 0),
  };

  return { clients: result, summary };
}

// ── Cross-sell (full list, not top-4) ──

const SUGGESTED_PREMIUM: Record<string, number> = {
  health: 18_000,
  term: 15_000,
  life: 25_000,
};
const COMMISSION_RATE: Record<string, number> = {
  health: 0.15,
  term: 0.30,
  life: 0.08,
};

export type CrossSellOpportunity = {
  clientId: string;
  name: string;
  phone: string;
  tier: Tier;
  has: string[];
  recommend: string;
  estPremium: number;
  estCommission: number;
  reason: string;
};

export type CrossSellSummary = {
  totalOpportunities: number;
  totalEstPremium: number;
  totalEstCommission: number;
  byRecommendation: { line: string; count: number; premium: number }[];
};

export async function getCrossSellOpportunities(now = new Date()): Promise<{ items: CrossSellOpportunity[]; summary: CrossSellSummary }> {
  const clients = await prisma.client.findMany({
    where: { archivedAt: null, deletedAt: null },
    include: {
      policies: {
        where: { deletedAt: null, status: "active" },
        select: { line: true, premium: true },
      },
    },
  });

  const items: CrossSellOpportunity[] = [];

  for (const c of clients) {
    const lines = new Set(c.policies.map((p) => p.line));
    if (lines.size === 0) continue;
    const totalPrem = c.policies.reduce((s, p) => s + p.premium, 0);
    const tier = computeTier(totalPrem, c.policies.length);
    const age = c.dob ? now.getFullYear() - c.dob.getFullYear() : 40;

    if ((lines.has("term") || lines.has("life")) && !lines.has("health")) {
      const est = SUGGESTED_PREMIUM.health;
      items.push({
        clientId: c.id, name: c.name, phone: c.phone || "", tier,
        has: [...lines], recommend: "health",
        estPremium: est, estCommission: Math.round(est * COMMISSION_RATE.health),
        reason: "Has life/term cover but no health — hospitalisation gap",
      });
    }
    if (lines.has("health") && !lines.has("term") && !lines.has("life") && age < 55) {
      const est = SUGGESTED_PREMIUM.term;
      items.push({
        clientId: c.id, name: c.name, phone: c.phone || "", tier,
        has: [...lines], recommend: "term",
        estPremium: est, estCommission: Math.round(est * COMMISSION_RATE.term),
        reason: "Health-only — no income protection for the family",
      });
    }
    if (lines.has("health") && lines.has("term") && !lines.has("life")) {
      const est = SUGGESTED_PREMIUM.life;
      items.push({
        clientId: c.id, name: c.name, phone: c.phone || "", tier,
        has: [...lines], recommend: "life endowment",
        estPremium: est, estCommission: Math.round(est * COMMISSION_RATE.life),
        reason: "Has term + health but no savings/endowment — wealth building gap",
      });
    }
  }

  items.sort((a, b) => b.estCommission - a.estCommission);

  const byRec = new Map<string, { count: number; premium: number }>();
  for (const it of items) {
    const cur = byRec.get(it.recommend) ?? { count: 0, premium: 0 };
    cur.count++;
    cur.premium += it.estPremium;
    byRec.set(it.recommend, cur);
  }

  return {
    items,
    summary: {
      totalOpportunities: items.length,
      totalEstPremium: items.reduce((s, it) => s + it.estPremium, 0),
      totalEstCommission: items.reduce((s, it) => s + it.estCommission, 0),
      byRecommendation: [...byRec.entries()].map(([line, v]) => ({ line, ...v })),
    },
  };
}

// ── Referral stats ──

export type ReferralStats = {
  totalLeads: number;
  bySource: { source: string; count: number; wonCount: number; conversionRate: number }[];
  referralConversion: number;
  topSource: string;
};

export async function getReferralStats(): Promise<ReferralStats> {
  const leads = await prisma.lead.findMany({
    select: { source: true, stage: true },
  });

  const bySource = new Map<string, { count: number; won: number }>();
  for (const l of leads) {
    const src = l.source || "other";
    const cur = bySource.get(src) ?? { count: 0, won: 0 };
    cur.count++;
    if (l.stage === "won") cur.won++;
    bySource.set(src, cur);
  }

  const entries = [...bySource.entries()]
    .map(([source, v]) => ({
      source,
      count: v.count,
      wonCount: v.won,
      conversionRate: v.count > 0 ? Math.round((v.won / v.count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const referralEntry = entries.find((e) => e.source === "referral");

  return {
    totalLeads: leads.length,
    bySource: entries,
    referralConversion: referralEntry?.conversionRate ?? 0,
    topSource: entries[0]?.source ?? "none",
  };
}
