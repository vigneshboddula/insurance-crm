"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { waSend, waState } from "@/lib/whatsapp/client";

// Approvals panel actions. These are AGENT-initiated one-tap sends, so they
// don't count against the automation daily cap (that governs the engine's own
// auto-sends). Each send logs a Communication and marks the Outbox row sent.

/** Send one queued message now (agent tapped Send). Optional edited text. */
export async function sendApproval(id: string, editedMessage?: string): Promise<{ ok: boolean; error?: string }> {
  const o = await prisma.outbox.findUnique({ where: { id } });
  if (!o) return { ok: false, error: "Not found" };
  if (o.status !== "pending") return { ok: false, error: "Already handled" };
  if (!o.phone) return { ok: false, error: "No phone number on file" };
  if (waState().status !== "ready") return { ok: false, error: "WhatsApp isn't connected — open WhatsApp and Connect first." };

  const message = editedMessage?.trim() || o.message;
  const res = await waSend(o.phone, message);
  if (res.ok) {
    await prisma.outbox.update({ where: { id }, data: { status: "sent", sentAt: new Date(), message } });
    if (o.clientId) await prisma.communication.create({ data: { clientId: o.clientId, channel: "whatsapp", direction: "outbound", subject: o.title, body: message, status: "sent" } });
  }
  revalidatePath("/");
  return res;
}

/** Dismiss a queued message without sending (agent handled it another way). */
export async function dismissApproval(id: string) {
  await prisma.outbox.updateMany({ where: { id, status: "pending" }, data: { status: "dismissed" } });
  revalidatePath("/");
}

/** Send every currently-pending approval over WhatsApp (throttled inside waSend). */
export async function sendAllApprovals(): Promise<{ sent: number; failed: number; total: number }> {
  if (waState().status !== "ready") return { sent: 0, failed: 0, total: 0 };
  const pend = await prisma.outbox.findMany({ where: { status: "pending" } });
  let sent = 0, failed = 0;
  for (const o of pend) {
    if (!o.phone) { failed++; continue; }
    const res = await waSend(o.phone, o.message);
    if (res.ok) {
      await prisma.outbox.update({ where: { id: o.id }, data: { status: "sent", sentAt: new Date() } });
      if (o.clientId) await prisma.communication.create({ data: { clientId: o.clientId, channel: "whatsapp", direction: "outbound", subject: o.title, body: o.message, status: "sent" } });
      sent++;
    } else failed++;
  }
  revalidatePath("/");
  return { sent, failed, total: pend.length };
}
