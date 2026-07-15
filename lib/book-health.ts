import "server-only";
import { prisma } from "@/lib/db";

// ──────────────────────────────────────────────────────────────
// Phase-1 (10k-scale) analytics: renewal leakage + data health.
// Leakage = renewals that came due but weren't completed (overdue actives and
// lapsed policies) — i.e. income currently being lost. Data health = the gaps
// that silently break automation at scale (no phone → reminders can't send;
// no notice → nothing to attach; zero SI/premium → wrong reports).
// ──────────────────────────────────────────────────────────────

const DAY = 86_400_000;

export type LeakRow = {
  policyId: string; clientId: string; name: string; carrier: string;
  policyNumber: string; premium: number; renewalDate: string;
  daysOverdue: number; status: string;
};

export type Leakage = {
  count: number;
  premiumAtRisk: number;
  renewedThisMonth: number;
  renewedPremiumThisMonth: number;
  rows: LeakRow[]; // worst first, capped
};

export async function getLeakage(now = new Date()): Promise<Leakage> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [lost, renewed] = await Promise.all([
    prisma.policy.findMany({
      where: {
        deletedAt: null,
        client: { archivedAt: null, deletedAt: null },
        OR: [{ status: "lapsed" }, { status: "active", renewalDate: { lt: now } }],
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { renewalDate: "asc" },
    }),
    prisma.renewal.findMany({
      where: { status: "renewed", renewedAt: { gte: monthStart }, policy: { client: { archivedAt: null } } },
      select: { amount: true },
    }),
  ]);

  return {
    count: lost.length,
    premiumAtRisk: Math.round(lost.reduce((s, p) => s + p.premium, 0)),
    renewedThisMonth: renewed.length,
    renewedPremiumThisMonth: Math.round(renewed.reduce((s, r) => s + r.amount, 0)),
    rows: lost.slice(0, 100).map((p) => ({
      policyId: p.id, clientId: p.clientId, name: p.client.name, carrier: p.carrier,
      policyNumber: p.policyNumber, premium: p.premium, renewalDate: p.renewalDate.toISOString(),
      daysOverdue: Math.max(0, Math.round((now.getTime() - p.renewalDate.getTime()) / DAY)),
      status: p.status,
    })),
  };
}

export type DataHealth = {
  clients: number;
  noPhone: number;
  noEmail: number;
  zeroSumInsured: number;
  zeroPremium: number;
  noPolicyType: number;
  noMembers: number;
  dueSoonNoNotice: number; // due ≤45d without a renewal-notice PDF
  noPolicyCopy: number;
  reviewQueue: number;
};

export async function getDataHealth(now = new Date()): Promise<DataHealth> {
  const in45 = new Date(now.getTime() + 45 * DAY);
  const activeClient = { archivedAt: null as null, deletedAt: null as null };
  const polBase = { deletedAt: null as null, client: activeClient };

  const [clients, noPhone, noEmail, zeroSI, zeroPrem, noType, noMembers, reviewQueue, noticeDocs, copyDocs, dueSoon, allPols] = await Promise.all([
    prisma.client.count({ where: activeClient }),
    prisma.client.count({ where: { ...activeClient, phone: "" } }),
    prisma.client.count({ where: { ...activeClient, OR: [{ email: null }, { email: "" }] } }),
    prisma.policy.count({ where: { ...polBase, sumAssured: 0 } }),
    prisma.policy.count({ where: { ...polBase, premium: 0 } }),
    prisma.policy.count({ where: { ...polBase, policyType: null } }),
    prisma.policy.count({ where: { ...polBase, insuredMembers: { none: {} } } }),
    prisma.ingestDoc.count({ where: { status: { in: ["review", "unmatched"] } } }),
    prisma.document.findMany({ where: { type: "renewal_notice", policyId: { not: null }, deletedAt: null }, select: { policyId: true } }),
    prisma.document.findMany({ where: { type: { in: ["policy_copy", "policy"] }, policyId: { not: null }, deletedAt: null }, select: { policyId: true } }),
    prisma.policy.findMany({ where: { ...polBase, status: "active", renewalDate: { gte: now, lte: in45 } }, select: { id: true } }),
    prisma.policy.findMany({ where: polBase, select: { id: true } }),
  ]);

  const hasNotice = new Set(noticeDocs.map((d) => d.policyId));
  const hasCopy = new Set(copyDocs.map((d) => d.policyId));

  return {
    clients, noPhone, noEmail,
    zeroSumInsured: zeroSI, zeroPremium: zeroPrem, noPolicyType: noType, noMembers,
    dueSoonNoNotice: dueSoon.filter((p) => !hasNotice.has(p.id)).length,
    noPolicyCopy: allPols.filter((p) => !hasCopy.has(p.id)).length,
    reviewQueue,
  };
}
