"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

function statusFor(expected: number, collected: number): string {
  if (collected <= 0) return "pending";
  if (collected < expected) return "partial";
  return "collected";
}

/** Record (or update) a premium collection for a policy's due cycle. Keyed by
 *  policyId + cycleDate so it's idempotent per premium cycle. */
export async function recordCollection(fd: FormData) {
  const policyId = String(fd.get("policyId") ?? "");
  const clientId = String(fd.get("clientId") ?? "");
  const cycleDate = new Date(String(fd.get("cycleDate") ?? ""));
  const expectedAmount = Number(fd.get("expectedAmount") ?? 0);
  const collectedAmount = Math.max(0, Number(String(fd.get("collectedAmount") ?? "0").replace(/[,₹\s]/g, "")) || 0);
  const mode = (fd.get("mode") as string) || undefined;
  if (!policyId || !clientId || isNaN(cycleDate.getTime())) throw new Error("Missing policy / cycle");

  const status = statusFor(expectedAmount, collectedAmount);
  const data = { expectedAmount, collectedAmount, mode, status, collectedAt: collectedAmount > 0 ? new Date() : null };
  await prisma.collection.upsert({
    where: { policyId_cycleDate: { policyId, cycleDate } },
    update: data,
    create: { policyId, clientId, cycleDate, ...data },
  });
  revalidatePath("/collections");
  revalidatePath("/");
}
