"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export async function logCommunication(fd: FormData) {
  const clientId = str(fd, "clientId");
  if (!clientId) throw new Error("Pick a client");
  const when = str(fd, "occurredAt");
  await prisma.communication.create({
    data: {
      clientId,
      channel: str(fd, "channel") ?? "call",
      direction: str(fd, "direction") ?? "outbound",
      subject: str(fd, "subject"),
      body: str(fd, "body"),
      status: "sent",
      occurredAt: when ? new Date(when) : new Date(),
    },
  });
  revalidatePath("/communications");
  revalidatePath(`/clients/${clientId}`);
}

export type CommSnapshot = {
  id: string; clientId: string; channel: string; direction: string;
  subject: string | null; body: string | null; outcome: string | null;
  status: string | null; occurredAt: string;
};

/** Delete a log entry, returning a snapshot so the UI can offer Undo. */
export async function deleteCommunication(id: string): Promise<CommSnapshot | null> {
  const c = await prisma.communication.findUnique({ where: { id } });
  if (!c) return null;
  await prisma.communication.delete({ where: { id } });
  revalidatePath("/communications");
  return {
    id: c.id, clientId: c.clientId, channel: c.channel, direction: c.direction,
    subject: c.subject, body: c.body, outcome: c.outcome, status: c.status,
    occurredAt: c.occurredAt.toISOString(),
  };
}

/** Undo a delete: recreate the entry exactly as it was (same id). */
export async function restoreCommunication(s: CommSnapshot) {
  await prisma.communication.create({
    data: {
      id: s.id, clientId: s.clientId, channel: s.channel, direction: s.direction,
      subject: s.subject, body: s.body, outcome: s.outcome, status: s.status,
      occurredAt: new Date(s.occurredAt),
    },
  });
  revalidatePath("/communications");
}
