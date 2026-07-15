import "server-only";
import { prisma } from "@/lib/db";

// ──────────────────────────────────────────────────────────────
// Phase 2: daily renewal worklist + escalation status.
//
// The worklist shows today's renewals (due within ±7d) ranked by
// urgency × premium. Each row carries an "escalation status" derived
// from what's already happened:
//   • "not_contacted" — no reminder sent yet for this renewal cycle
//   • "reminded"      — WhatsApp sent, ≤3d ago (waiting for reply)
//   • "no_reply"      — WhatsApp sent >3d ago, no renewal yet → needs call
//   • "called"        — a call task exists
//   • "at_risk"       — called but still no renewal → flag for attention
//   • "renewed"       — done
//
// Dead-number detection: clients whose last 2+ WhatsApp sends failed.
// ──────────────────────────────────────────────────────────────

const DAY = 86_400_000;

export type EscalationStatus = "not_contacted" | "reminded" | "no_reply" | "called" | "at_risk" | "renewed";

export type WorklistRow = {
  policyId: string;
  clientId: string;
  name: string;
  phone: string;
  carrier: string;
  planName: string;
  policyNumber: string;
  premium: number;
  renewalDate: string;
  daysUntilDue: number;
  escalation: EscalationStatus;
  lastReminderAt: string | null;
  hasCallTask: boolean;
  deadNumber: boolean;
};

export type WorklistSummary = {
  total: number;
  notContacted: number;
  noReply: number;
  atRisk: number;
  deadNumbers: number;
  premiumAtStake: number;
};

export async function getTodayWorklist(now = new Date()): Promise<{ rows: WorklistRow[]; summary: WorklistSummary }> {
  const from = new Date(now.getTime() - 7 * DAY);
  const to = new Date(now.getTime() + 30 * DAY);
  const threeDaysAgo = new Date(now.getTime() - 3 * DAY);

  const policies = await prisma.policy.findMany({
    where: {
      deletedAt: null,
      status: "active",
      renewalDate: { gte: from, lte: to },
      client: { archivedAt: null, deletedAt: null },
    },
    include: {
      client: { select: { id: true, name: true, phone: true } },
      renewals: { where: { status: "renewed" }, take: 1 },
    },
    orderBy: { renewalDate: "asc" },
  });

  const policyIds = policies.map((p) => p.id);
  const clientIds = [...new Set(policies.map((p) => p.clientId))];

  const [reminders, callTasks, failedSends] = await Promise.all([
    prisma.renewalReminder.findMany({
      where: { policyId: { in: policyIds } },
      orderBy: { sentAt: "desc" },
    }),
    prisma.task.findMany({
      where: {
        clientId: { in: clientIds },
        type: "call",
        status: { not: "completed" },
      },
      select: { clientId: true },
    }),
    prisma.autoSend.findMany({
      where: {
        clientId: { in: clientIds },
        category: "renewal",
        status: "failed",
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const reminderByPolicy = new Map<string, Date>();
  for (const r of reminders) {
    if (!reminderByPolicy.has(r.policyId)) reminderByPolicy.set(r.policyId, r.sentAt);
  }
  const callTaskClients = new Set(callTasks.map((t) => t.clientId));

  const failCountByClient = new Map<string, number>();
  for (const f of failedSends) {
    if (!f.clientId) continue;
    failCountByClient.set(f.clientId, (failCountByClient.get(f.clientId) ?? 0) + 1);
  }

  const rows: WorklistRow[] = [];
  for (const p of policies) {
    if (p.renewals.length > 0) continue; // already renewed

    const daysUntilDue = Math.round((p.renewalDate.getTime() - now.getTime()) / DAY);
    const lastReminder = reminderByPolicy.get(p.id) ?? null;
    const hasCall = callTaskClients.has(p.clientId);
    const deadNumber = (failCountByClient.get(p.clientId) ?? 0) >= 2;

    let escalation: EscalationStatus = "not_contacted";
    if (lastReminder) {
      if (hasCall) {
        escalation = daysUntilDue < 0 ? "at_risk" : "called";
      } else if (lastReminder < threeDaysAgo) {
        escalation = "no_reply";
      } else {
        escalation = "reminded";
      }
    }

    rows.push({
      policyId: p.id,
      clientId: p.clientId,
      name: p.client.name,
      phone: p.client.phone || "",
      carrier: p.carrier,
      planName: p.planName || p.variant || p.carrier,
      policyNumber: p.policyNumber,
      premium: p.premium,
      renewalDate: p.renewalDate.toISOString(),
      daysUntilDue,
      escalation,
      lastReminderAt: lastReminder?.toISOString() ?? null,
      hasCallTask: hasCall,
      deadNumber,
    });
  }

  // Sort: overdue first (most overdue at top), then soonest due, then by premium
  rows.sort((a, b) => a.daysUntilDue - b.daysUntilDue || b.premium - a.premium);

  return {
    rows,
    summary: {
      total: rows.length,
      notContacted: rows.filter((r) => r.escalation === "not_contacted").length,
      noReply: rows.filter((r) => r.escalation === "no_reply").length,
      atRisk: rows.filter((r) => r.escalation === "at_risk").length,
      deadNumbers: rows.filter((r) => r.deadNumber).length,
      premiumAtStake: Math.round(rows.reduce((s, r) => s + r.premium, 0)),
    },
  };
}
