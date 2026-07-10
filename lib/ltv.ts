import "server-only";
import { prisma } from "@/lib/db";

// Item 25 — client lifetime-value ranking. Transparent heuristic (like the rest
// of the insights engine): annualized in-force premium × a forward horizon,
// plus a small loyalty weight for tenure. Money = the ranking signal; tiers give
// the agent an at-a-glance "who matters most".

const FREQ_MULT: Record<string, number> = { monthly: 12, quarterly: 4, half_yearly: 2, annual: 1 };
const HORIZON_YEARS = 5; // expected forward relationship

type PolicyLite = { premium: number; frequency: string; status: string; firstInception?: Date | null; startDate?: Date };

/** Annualized premium across a holder's in-force policies. */
export function annualPremiumOf(policies: PolicyLite[]): number {
  return policies.filter((p) => p.status === "active").reduce((s, p) => s + p.premium * (FREQ_MULT[p.frequency] ?? 1), 0);
}

export type Ltv = { annual: number; value: number; tenureYears: number; policies: number };

export function ltvOf(policies: PolicyLite[]): Ltv {
  const active = policies.filter((p) => p.status === "active");
  const annual = annualPremiumOf(policies);
  const years = active.map((p) => (p.firstInception ?? p.startDate ?? new Date()).getFullYear());
  const since = years.length ? Math.min(...years) : new Date().getFullYear();
  const tenureYears = Math.max(1, new Date().getFullYear() - since + 1);
  // 5-yr forward value + a modest loyalty uplift (2% per year held, capped 20%)
  const loyalty = 1 + Math.min(0.2, (tenureYears - 1) * 0.02);
  const value = Math.round(annual * HORIZON_YEARS * loyalty);
  return { annual, value, tenureYears, policies: active.length };
}

export type Tier = { label: "Platinum" | "Gold" | "Silver" | "Bronze"; tone: string };

/** Tier by annualized premium (₹/yr). */
export function tierOf(annual: number): Tier {
  if (annual >= 100000) return { label: "Platinum", tone: "var(--accent-700)" };
  if (annual >= 50000) return { label: "Gold", tone: "var(--amber-700)" };
  if (annual >= 20000) return { label: "Silver", tone: "var(--ink-2)" };
  return { label: "Bronze", tone: "var(--ink-3)" };
}

export type RankedClient = { id: string; name: string; phone: string; annual: number; value: number; tenureYears: number; policies: number; tier: Tier["label"] };

/** All non-archived holders ranked by lifetime value (desc). */
export async function getClientValueRanking(limit?: number): Promise<RankedClient[]> {
  const clients = await prisma.client.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, phone: true, policies: { select: { premium: true, frequency: true, status: true, firstInception: true, startDate: true } } },
  });
  const ranked = clients
    .map((c) => {
      const l = ltvOf(c.policies);
      return { id: c.id, name: c.name, phone: c.phone, annual: l.annual, value: l.value, tenureYears: l.tenureYears, policies: l.policies, tier: tierOf(l.annual).label };
    })
    .filter((c) => c.policies > 0)
    .sort((a, b) => b.value - a.value);
  return limit ? ranked.slice(0, limit) : ranked;
}
