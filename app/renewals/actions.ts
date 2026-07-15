"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

/** Mark a policy renewed: close its pending renewal and roll the due date forward a year. */
export async function markRenewed(policyId: string) {
  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
    include: { renewals: { where: { status: { in: ["pending", "reminded"] } }, orderBy: { dueDate: "asc" } } },
  });
  if (!policy) return;

  if (policy.renewals[0]) {
    await prisma.renewal.update({ where: { id: policy.renewals[0].id }, data: { status: "renewed", renewedAt: new Date() } });
  } else {
    await prisma.renewal.create({ data: { policyId, dueDate: policy.renewalDate, amount: policy.premium, status: "renewed", renewedAt: new Date() } });
  }

  const next = new Date(policy.renewalDate);
  next.setFullYear(next.getFullYear() + 1);
  await prisma.policy.update({ where: { id: policyId }, data: { renewalDate: next } });

  revalidatePath("/renewals");
  revalidatePath("/");
  revalidatePath(`/clients/${policy.clientId}`);
}

/** Create a "call this client about their renewal" task — used by the
 *  escalation ladder when WhatsApp got no reply after 3 days. */
export async function createCallTask(clientId: string, policyId: string, clientName: string, policyNumber: string) {
  const existing = await prisma.task.findFirst({ where: { clientId, type: "call", status: { not: "completed" } } });
  if (existing) return; // don't duplicate
  await prisma.task.create({
    data: {
      clientId,
      type: "call",
      title: `Call ${clientName} — renewal ${policyNumber}`,
      notes: `WhatsApp reminder sent >3 days ago with no reply. Call to follow up on renewal.`,
      status: "open",
      priority: "high",
      dueDate: new Date(),
    },
  });
  revalidatePath("/renewals");
  revalidatePath("/tasks");
}
