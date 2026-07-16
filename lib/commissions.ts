import "server-only";
import { prisma } from "@/lib/db";

// ──────────────────────────────────────────────────────────────
// Phase 3: Commission tracking + reconciliation.
//
// Expected commission is auto-computed from premium × line rate.
// Received commission comes from importing insurer commission
// statements (Excel). Reconciliation = expected vs received,
// surfacing shortfalls you can chase with the insurer.
// ──────────────────────────────────────────────────────────────

const RATES: Record<string, number> = {
  term: 0.30, life: 0.08, health: 0.15, personal_accident: 0.15,
  motor: 0.12, travel: 0.10, mutual_fund: 0.02,
};

export function expectedRate(line: string): number {
  return RATES[line] ?? 0.10;
}

export type CommissionRow = {
  policyId: string;
  clientId: string;
  clientName: string;
  carrier: string;
  policyNumber: string;
  line: string;
  premium: number;
  expected: number;
  received: number;
  shortfall: number;
  status: string;
};

export type CommissionSummary = {
  totalExpected: number;
  totalReceived: number;
  totalShortfall: number;
  paidCount: number;
  pendingCount: number;
  shortfallCount: number;
};

export async function getCommissions(): Promise<{ rows: CommissionRow[]; summary: CommissionSummary }> {
  const policies = await prisma.policy.findMany({
    where: { deletedAt: null, client: { archivedAt: null, deletedAt: null } },
    include: {
      client: { select: { id: true, name: true } },
      commission: true,
    },
    orderBy: { startDate: "desc" },
  });

  const rows: CommissionRow[] = [];
  let totalExpected = 0, totalReceived = 0, paidCount = 0, pendingCount = 0, shortfallCount = 0;

  for (const p of policies) {
    const rate = expectedRate(p.line);
    const expected = Math.round(p.premium * rate);
    const received = p.commission?.receivedAmount ?? 0;
    const shortfall = Math.max(0, expected - received);
    const status = p.commission?.status ?? "pending";

    totalExpected += expected;
    totalReceived += received;
    if (status === "received") paidCount++;
    else pendingCount++;
    if (shortfall > 0 && received > 0) shortfallCount++;

    rows.push({
      policyId: p.id,
      clientId: p.clientId,
      clientName: p.client.name,
      carrier: p.carrier,
      policyNumber: p.policyNumber,
      line: p.line,
      premium: p.premium,
      expected,
      received: Math.round(received),
      shortfall,
      status,
    });
  }

  return {
    rows,
    summary: {
      totalExpected, totalReceived,
      totalShortfall: Math.max(0, totalExpected - totalReceived),
      paidCount, pendingCount, shortfallCount,
    },
  };
}
