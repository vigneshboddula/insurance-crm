"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { readDecryptedFile } from "@/lib/storage";
import { waSend, waState } from "@/lib/whatsapp/client";
import { getDueReminders, recordReminderSent, type Step } from "@/lib/reminders";

type One = { policyId: string; clientId: string; step: Step; cycleDate: string; message: string; phone: string | null; noticeDocId?: string | null };

async function record(one: One) {
  await recordReminderSent({ ...one, via: "manual" });
}

/** Load a renewal-notice document as WhatsApp media (decrypt from disk). */
async function noticeMedia(docId: string | null | undefined): Promise<{ mime: string; base64: string; filename: string } | undefined> {
  if (!docId) return undefined;
  const doc = await prisma.document.findUnique({ where: { id: docId }, select: { storagePath: true, mimeType: true, fileName: true } });
  if (!doc) return undefined;
  try {
    const buf = await readDecryptedFile(doc.storagePath);
    return { mime: doc.mimeType || "application/pdf", base64: buf.toString("base64"), filename: doc.fileName };
  } catch {
    return undefined; // missing blob — send text only
  }
}

/** Send a single due reminder over WhatsApp (with the renewal-notice PDF attached) and log it. */
export async function sendReminderNow(one: One): Promise<{ ok: boolean; error?: string }> {
  if (!one.phone) return { ok: false, error: "No phone number on file" };
  if (waState().status !== "ready") return { ok: false, error: "WhatsApp isn't connected — open WhatsApp and Connect first." };
  const media = await noticeMedia(one.noticeDocId);
  const res = await waSend(one.phone, one.message, media);
  if (res.ok) await record(one);
  revalidatePath("/renewals");
  return res;
}

/** Mark a reminder as handled without sending (e.g. you contacted them another way). */
export async function skipReminder(one: One) {
  await prisma.renewalReminder.create({
    data: { policyId: one.policyId, cycleDate: new Date(one.cycleDate), step: one.step, scheduledFor: new Date(), channel: "skipped" },
  });
  revalidatePath("/renewals");
}

/** Send every currently-due reminder over WhatsApp (throttled inside waSend). */
export async function sendAllDueReminders(): Promise<{ sent: number; failed: number; total: number }> {
  if (waState().status !== "ready") return { sent: 0, failed: 0, total: 0 };
  const due = await getDueReminders();
  let sent = 0, failed = 0;
  for (const d of due) {
    if (!d.phone) { failed++; continue; }
    const media = await noticeMedia(d.noticeDocId);
    const res = await waSend(d.phone, d.message, media);
    if (res.ok) { await record({ policyId: d.policyId, clientId: d.clientId, step: d.step, cycleDate: d.cycleDate, message: d.message, phone: d.phone, noticeDocId: d.noticeDocId }); sent++; }
    else failed++;
  }
  revalidatePath("/renewals");
  return { sent, failed, total: due.length };
}
