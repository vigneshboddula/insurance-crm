"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}
function num(fd: FormData, key: string): number | undefined {
  const s = str(fd, key);
  if (s === undefined) return undefined;
  const n = Number(s.replace(/[,₹\s]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export async function createLead(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("Name is required");
  const stage = str(fd, "stage") ?? "new";
  await prisma.lead.create({
    data: {
      name,
      phone: str(fd, "phone"),
      source: str(fd, "source") ?? "referral",
      stage,
      interest: str(fd, "interest"),
      expectedPremium: num(fd, "expectedPremium"),
      notes: str(fd, "notes"),
      quotedAt: stage === "quoted" ? new Date() : undefined, // starts the quote follow-up autopilot
    },
  });
  revalidatePath("/leads");
  revalidatePath("/");
}

export async function updateLead(fd: FormData) {
  const id = str(fd, "id");
  if (!id) throw new Error("Missing lead");
  const stage = str(fd, "stage");
  let quotedAt: Date | undefined;
  if (stage === "quoted") {
    const cur = await prisma.lead.findUnique({ where: { id }, select: { quotedAt: true } });
    if (!cur?.quotedAt) quotedAt = new Date();
  }
  await prisma.lead.update({
    where: { id },
    data: {
      name: str(fd, "name"),
      phone: str(fd, "phone") ?? null,
      source: str(fd, "source"),
      stage,
      interest: str(fd, "interest") ?? null,
      expectedPremium: num(fd, "expectedPremium") ?? null,
      notes: str(fd, "notes") ?? null,
      ...(quotedAt ? { quotedAt } : {}),
    },
  });
  revalidatePath("/leads");
  revalidatePath("/");
}

export async function setLeadStage(id: string, stage: string) {
  // Stamp quotedAt the first time a lead reaches "quoted" (drives the day 2/5/10 autopilot).
  let quotedAt: Date | undefined;
  if (stage === "quoted") {
    const cur = await prisma.lead.findUnique({ where: { id }, select: { quotedAt: true } });
    if (!cur?.quotedAt) quotedAt = new Date();
  }
  await prisma.lead.update({ where: { id }, data: { stage, ...(quotedAt ? { quotedAt } : {}) } });
  revalidatePath("/leads");
  revalidatePath("/");
}

export type LeadSnapshot = {
  id: string; name: string; phone: string | null; source: string; stage: string;
  interest: string | null; expectedPremium: number | null; score: number | null;
  scoreReason: string | null; notes: string | null; clientId: string | null; createdAt: string;
};

/** Delete a lead, returning a snapshot so the UI can offer Undo. */
export async function deleteLead(id: string): Promise<LeadSnapshot | null> {
  const l = await prisma.lead.findUnique({ where: { id } });
  if (!l) return null;
  await prisma.lead.delete({ where: { id } });
  revalidatePath("/leads");
  revalidatePath("/");
  return {
    id: l.id, name: l.name, phone: l.phone, source: l.source, stage: l.stage,
    interest: l.interest, expectedPremium: l.expectedPremium, score: l.score,
    scoreReason: l.scoreReason, notes: l.notes, clientId: l.clientId, createdAt: l.createdAt.toISOString(),
  };
}

/** Undo a delete: recreate the lead exactly as it was (same id). */
export async function restoreLead(s: LeadSnapshot) {
  await prisma.lead.create({
    data: {
      id: s.id, name: s.name, phone: s.phone, source: s.source, stage: s.stage,
      interest: s.interest, expectedPremium: s.expectedPremium, score: s.score,
      scoreReason: s.scoreReason, notes: s.notes, clientId: s.clientId, createdAt: new Date(s.createdAt),
    },
  });
  revalidatePath("/leads");
  revalidatePath("/");
}

/** Turn a won lead into a real policy holder, then open their profile. */
export async function convertLead(id: string) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new Error("Lead not found");

  let clientId = lead.clientId ?? undefined;
  if (!clientId) {
    const client = await prisma.client.create({
      data: {
        name: lead.name,
        phone: lead.phone ?? "",
        tags: "from-lead",
        notes: lead.notes ?? undefined,
      },
    });
    clientId = client.id;
  }
  await prisma.lead.update({ where: { id }, data: { stage: "won", clientId } });
  revalidatePath("/leads");
  revalidatePath("/clients");
  revalidatePath("/");
  redirect(`/clients/${clientId}`);
}
