import "server-only";
import { prisma } from "@/lib/db";

const DAY = 86_400_000;

// ── Claims with TAT tracking ──

export type ClaimRow = {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  policyId: string;
  policyNumber: string;
  carrier: string;
  claimNumber: string | null;
  reason: string;
  amount: number;
  status: string;
  intimatedAt: string;
  daysSinceIntimated: number;
  tatAlert: "overdue" | "warning" | "ok";
  notes: string | null;
};

export type ClaimSummary = {
  total: number;
  intimated: number;
  inProgress: number;
  settled: number;
  rejected: number;
  overdueCount: number;
  totalAmount: number;
};

const TAT_DAYS: Record<string, number> = {
  intimated: 7,
  documents_submitted: 14,
  under_review: 21,
  approved: 7,
};

export async function getClaims(now = new Date()): Promise<{ rows: ClaimRow[]; summary: ClaimSummary }> {
  const claims = await prisma.claim.findMany({
    include: {
      client: { select: { id: true, name: true, phone: true } },
      policy: { select: { id: true, policyNumber: true, carrier: true } },
    },
    orderBy: { intimatedAt: "desc" },
  });

  const rows: ClaimRow[] = [];
  let intimated = 0, inProgress = 0, settled = 0, rejected = 0, overdueCount = 0, totalAmount = 0;

  for (const c of claims) {
    const days = Math.round((now.getTime() - c.intimatedAt.getTime()) / DAY);
    const tatLimit = TAT_DAYS[c.status] ?? 14;
    const tatAlert: "overdue" | "warning" | "ok" =
      ["settled", "rejected"].includes(c.status) ? "ok"
        : days > tatLimit ? "overdue"
          : days > tatLimit - 3 ? "warning" : "ok";

    if (c.status === "intimated") intimated++;
    else if (["settled", "paid"].includes(c.status)) settled++;
    else if (c.status === "rejected") rejected++;
    else inProgress++;
    if (tatAlert === "overdue") overdueCount++;
    totalAmount += c.amount ?? 0;

    rows.push({
      id: c.id,
      clientId: c.client.id,
      clientName: c.client.name,
      clientPhone: c.client.phone || "",
      policyId: c.policy.id,
      policyNumber: c.policy.policyNumber,
      carrier: c.policy.carrier,
      claimNumber: c.claimNumber,
      reason: c.reason || "",
      amount: c.amount ?? 0,
      status: c.status,
      intimatedAt: c.intimatedAt.toISOString(),
      daysSinceIntimated: days,
      tatAlert,
      notes: c.notes,
    });
  }

  return {
    rows,
    summary: { total: claims.length, intimated, inProgress, settled, rejected, overdueCount, totalAmount },
  };
}

// ── Endorsements (servicing requests) ──

export type EndorsementRow = {
  id: string;
  clientId: string;
  clientName: string;
  policyId: string;
  policyNumber: string;
  carrier: string;
  type: string;
  description: string;
  status: string;
  referenceNo: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  daysPending: number | null;
  notes: string | null;
};

export type EndorsementSummary = {
  total: number;
  requested: number;
  submitted: number;
  approved: number;
  rejected: number;
};

export async function getEndorsements(now = new Date()): Promise<{ rows: EndorsementRow[]; summary: EndorsementSummary }> {
  const items = await prisma.endorsement.findMany({
    include: {
      policy: { select: { id: true, policyNumber: true, carrier: true } },
      client: { select: { id: true, name: true } },
    },
    orderBy: { requestedAt: "desc" },
  });

  const rows: EndorsementRow[] = [];
  let requested = 0, submitted = 0, approved = 0, rejected = 0;

  for (const e of items) {
    const pending = !e.resolvedAt ? Math.round((now.getTime() - e.requestedAt.getTime()) / DAY) : null;

    if (e.status === "requested") requested++;
    else if (e.status === "submitted") submitted++;
    else if (e.status === "approved") approved++;
    else if (e.status === "rejected") rejected++;

    rows.push({
      id: e.id,
      clientId: e.client.id,
      clientName: e.client.name,
      policyId: e.policy.id,
      policyNumber: e.policy.policyNumber,
      carrier: e.policy.carrier,
      type: e.type,
      description: e.description || "",
      status: e.status,
      referenceNo: e.referenceNo,
      requestedAt: e.requestedAt.toISOString(),
      resolvedAt: e.resolvedAt?.toISOString() ?? null,
      daysPending: pending,
      notes: e.notes,
    });
  }

  return {
    rows,
    summary: { total: items.length, requested, submitted, approved, rejected },
  };
}

// ── Instant client card (phone search) ──

export type ClientCard = {
  id: string;
  name: string;
  phone: string;
  email: string;
  activePolicies: { id: string; carrier: string; planName: string; policyNumber: string; premium: number; renewalDate: string; line: string }[];
  totalPremium: number;
  upcomingRenewal: { policyNumber: string; carrier: string; daysUntil: number; premium: number } | null;
  openClaims: number;
  pendingEndorsements: number;
  lastContact: string | null;
};

export async function getClientCard(phone: string, now = new Date()): Promise<ClientCard | null> {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);

  const client = await prisma.client.findFirst({
    where: {
      phone: { contains: last10 },
      archivedAt: null,
      deletedAt: null,
    },
    include: {
      policies: {
        where: { deletedAt: null, status: "active" },
        select: { id: true, carrier: true, planName: true, policyNumber: true, premium: true, renewalDate: true, line: true },
        orderBy: { renewalDate: "asc" },
      },
      claims: { where: { status: { notIn: ["settled", "rejected", "paid"] } }, select: { id: true } },
      endorsements: { where: { status: { in: ["requested", "submitted"] } }, select: { id: true } },
      communications: { orderBy: { occurredAt: "desc" }, take: 1, select: { occurredAt: true } },
    },
  });

  if (!client) return null;

  const totalPremium = client.policies.reduce((s, p) => s + p.premium, 0);
  const soonest = client.policies[0];
  const upcomingRenewal = soonest ? {
    policyNumber: soonest.policyNumber,
    carrier: soonest.carrier,
    daysUntil: Math.round((soonest.renewalDate.getTime() - now.getTime()) / DAY),
    premium: soonest.premium,
  } : null;

  return {
    id: client.id,
    name: client.name,
    phone: client.phone || "",
    email: client.email || "",
    activePolicies: client.policies.map((p) => ({
      ...p,
      planName: p.planName || "",
      renewalDate: p.renewalDate.toISOString(),
    })),
    totalPremium,
    upcomingRenewal,
    openClaims: client.claims.length,
    pendingEndorsements: client.endorsements.length,
    lastContact: client.communications[0]?.occurredAt?.toISOString() ?? null,
  };
}
