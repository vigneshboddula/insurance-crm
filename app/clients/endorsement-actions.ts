"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export async function createEndorsement(fd: FormData) {
  const policyId = str(fd, "policyId");
  const clientId = str(fd, "clientId");
  const type = str(fd, "type");
  if (!policyId || !clientId || !type) throw new Error("Policy, client and type are required");
  await prisma.endorsement.create({
    data: {
      policyId, clientId, type,
      description: str(fd, "description"),
      status: str(fd, "status") ?? "requested",
      referenceNo: str(fd, "referenceNo"),
      notes: str(fd, "notes"),
    },
  });
  revalidatePath(`/clients/${clientId}`);
}

export async function setEndorsementStatus(id: string, status: string, clientId: string) {
  const resolved = status === "approved" || status === "rejected";
  await prisma.endorsement.update({ where: { id }, data: { status, resolvedAt: resolved ? new Date() : null } });
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteEndorsement(id: string, clientId: string) {
  await prisma.endorsement.delete({ where: { id } });
  revalidatePath(`/clients/${clientId}`);
}
