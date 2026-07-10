import "server-only";
import { prisma } from "@/lib/db";

export type PendingApproval = {
  id: string; category: string; title: string; message: string;
  clientId: string | null; phone: string | null; createdAt: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  quote: "Quote follow-up", winback: "Win-back", claim: "Claim update",
  thankyou: "Thank-you", anniversary: "Anniversary", selfservice: "Self-service",
};

export function approvalLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

/** Messages the engine has prepared and are waiting for a one-tap send. */
export async function getPendingApprovals(): Promise<PendingApproval[]> {
  const rows = await prisma.outbox.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" }, take: 100 });
  return rows.map((o) => ({
    id: o.id, category: o.category, title: o.title, message: o.message,
    clientId: o.clientId, phone: o.phone, createdAt: o.createdAt.toISOString(),
  }));
}

export async function countPendingApprovals(): Promise<number> {
  return prisma.outbox.count({ where: { status: "pending" } });
}
