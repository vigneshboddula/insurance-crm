import { prisma } from "@/lib/db";
import { ReportsView } from "@/components/reports/ReportsView";

export const dynamic = "force-dynamic";

const RATE: Record<string, number> = { term: 0.3, life: 0.08, health: 0.15, personal_accident: 0.15, motor: 0.12, mutual_fund: 0.02 };
const MONTHS = 6;

export default async function ReportsPage() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1);

  const [policies, renewals, leads, comms] = await Promise.all([
    prisma.policy.findMany({ where: { client: { archivedAt: null } }, select: { startDate: true, premium: true, line: true } }),
    prisma.renewal.findMany({ where: { status: "renewed", renewedAt: { not: null } }, include: { policy: { select: { line: true } } } }),
    prisma.lead.findMany({ select: { stage: true, createdAt: true } }),
    prisma.communication.findMany({ select: { occurredAt: true } }),
  ]);

  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  type Row = { key: string; label: string; newPolicies: number; newPremium: number; renewalsSaved: number; renewedPremium: number; quotes: number; comms: number; estCommission: number };
  const rows: Row[] = [];
  for (let i = 0; i < MONTHS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1) + i, 1);
    rows.push({ key: key(d), label: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }), newPolicies: 0, newPremium: 0, renewalsSaved: 0, renewedPremium: 0, quotes: 0, comms: 0, estCommission: 0 });
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));

  for (const p of policies) {
    if (p.startDate < start) continue;
    const r = byKey.get(key(p.startDate)); if (!r) continue;
    r.newPolicies++; r.newPremium += p.premium; r.estCommission += p.premium * (RATE[p.line] ?? 0.1);
  }
  for (const rn of renewals) {
    if (!rn.renewedAt || rn.renewedAt < start) continue;
    const r = byKey.get(key(rn.renewedAt)); if (!r) continue;
    r.renewalsSaved++; r.renewedPremium += rn.amount; r.estCommission += rn.amount * (RATE[rn.policy?.line ?? ""] ?? 0.1);
  }
  for (const l of leads) {
    if (l.stage !== "quoted" || l.createdAt < start) continue;
    const r = byKey.get(key(l.createdAt)); if (r) r.quotes++;
  }
  for (const c of comms) {
    if (c.occurredAt < start) continue;
    const r = byKey.get(key(c.occurredAt)); if (r) r.comms++;
  }

  const shaped = rows.map((r) => ({
    label: r.label,
    newPolicies: r.newPolicies,
    renewalsSaved: r.renewalsSaved,
    premiumSecured: Math.round(r.newPremium + r.renewedPremium),
    estCommission: Math.round(r.estCommission),
    quotes: r.quotes,
    comms: r.comms,
  }));

  return <ReportsView rows={shaped} generatedAt={now.toISOString()} />;
}
