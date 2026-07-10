import "server-only";
import { prisma } from "@/lib/db";
import { getDueReminders, recordReminderSent } from "@/lib/reminders";
import { collectDueTouches, type TouchCategory } from "@/lib/automations";
import { waState, waSend } from "@/lib/whatsapp/client";
import { readDecryptedFile } from "@/lib/storage";

/** Load a renewal-notice document as WhatsApp media (decrypt from disk). */
async function noticeMedia(docId: string | null | undefined) {
  if (!docId) return undefined;
  const doc = await prisma.document.findUnique({ where: { id: docId }, select: { storagePath: true, mimeType: true, fileName: true } });
  if (!doc) return undefined;
  try {
    const buf = await readDecryptedFile(doc.storagePath);
    return { mime: doc.mimeType || "application/pdf", base64: buf.toString("base64"), filename: doc.fileName };
  } catch { return undefined; }
}

// ──────────────────────────────────────────────────────────────
// Phase 3 · Auto-send cadence (item 13).
//
// The safety layer that governs every client-facing automated message. Two
// modes per category:
//   • "approve" (default) — the engine does NOTHING; the message waits in the
//     approve queue (the RemindersDue panel on /renewals) for a one-tap send.
//   • "auto" — the engine sends it for you, but only within the limits below.
//
// Auto-mode is fenced by three guards so it can never spam or wake anyone:
//   1. The master engine switch must be on (engineEnabled).
//   2. Quiet hours — no auto-sends outside the allowed window.
//   3. A daily cap across ALL categories, plus a small per-tick cap so sends
//      trickle out across the day (human-like) instead of firing in one burst.
//
// Dedupe + logging reuse the proven renewal path (recordReminderSent), so an
// auto-sent reminder never repeats and never double-sends with a manual one.
// ──────────────────────────────────────────────────────────────

// Cap how many auto-sends go out in a single 15-min tick, so a big backlog is
// spread over the day rather than blasted at once (on top of waSend's own 3–5s
// per-message spacing).
const PER_TICK_CAP = 6;

export type AutoSendSummary = { sent: number; failed: number; skipped: string | null };

/** True when `now` falls inside the quiet-hours window (handles the midnight wrap). */
export function inQuietHours(now: Date, quietStart: number, quietEnd: number): boolean {
  if (quietStart === quietEnd) return false; // window disabled
  const h = now.getHours();
  return quietStart < quietEnd
    ? h >= quietStart && h < quietEnd // same-day window, e.g. 0–6
    : h >= quietStart || h < quietEnd; // wraps midnight, e.g. 21–9
}

function startOfToday(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** How many messages the engine has auto-sent so far today (for the daily cap). */
export async function autoSentToday(now = new Date()): Promise<number> {
  return prisma.autoSend.count({ where: { status: "sent", createdAt: { gte: startOfToday(now) } } });
}

/**
 * Send whatever is due for any category currently set to "auto", within the
 * quiet-hours + daily/per-tick caps. Called from the engine tick. Never throws
 * out — returns a summary (with `skipped` set when a guard stopped it early).
 */
export async function runAutoSends(): Promise<AutoSendSummary> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!s?.engineEnabled) return { sent: 0, failed: 0, skipped: "engine off" };

  const now = new Date();

  // Queue pending Outbox rows for every due touch FIRST — this is DB-only and
  // must happen regardless of quiet hours / WhatsApp state so approve-mode items
  // are never lost. Sending is gated separately below.
  const modes = { quote: s.quoteSendMode, winback: s.winbackMode, claim: s.claimSeqMode, delight: s.delightMode };
  if (Object.values(modes).some((m) => m !== "off")) {
    try {
      const touches = await collectDueTouches(modes, now);
      for (const list of Object.values(touches)) {
        for (const t of list) {
          await prisma.outbox.upsert({
            where: { dedupeRef: t.dedupeRef },
            create: { category: t.category, clientId: t.clientId ?? null, leadId: t.leadId ?? null, phone: t.phone, title: t.title, message: t.message, docId: t.docId ?? null, dedupeRef: t.dedupeRef, status: "pending" },
            update: {},
          });
        }
      }
    } catch (e) { console.error("[autosend] queue failed:", e instanceof Error ? e.message : e); }
  }

  // Sending guards: quiet hours, WhatsApp connected, and the daily cap.
  if (inQuietHours(now, s.quietStart, s.quietEnd)) return { sent: 0, failed: 0, skipped: "quiet hours" };
  if (waState().status !== "ready") return { sent: 0, failed: 0, skipped: "whatsapp not connected" };

  const already = await autoSentToday(now);
  let budget = Math.min(PER_TICK_CAP, Math.max(0, s.autoSendDailyCap - already));
  if (budget <= 0) return { sent: 0, failed: 0, skipped: "daily cap reached" };

  let sent = 0, failed = 0;

  // ── Category: renewal reminders (own dedupe/log path) ─────────
  if (s.renewalSendMode === "auto") {
    const due = await getDueReminders(); // already sorted: grace/urgent first
    for (const d of due) {
      if (budget <= 0) break;
      if (!d.phone) continue; // no number — leave it for the agent to handle
      const res = await waSend(d.phone, d.message, await noticeMedia(d.noticeDocId));
      if (res.ok) {
        await recordReminderSent({ policyId: d.policyId, clientId: d.clientId, step: d.step, cycleDate: d.cycleDate, message: d.message, via: "auto" });
        await prisma.autoSend.create({ data: { category: "renewal", clientId: d.clientId, status: "sent", detail: `${d.policyId}|${d.step}` } });
        sent++; budget--;
      } else {
        await prisma.autoSend.create({ data: { category: "renewal", clientId: d.clientId, status: "failed", detail: res.error?.slice(0, 140) } });
        failed++;
      }
    }
  }

  // ── Categories 17 & 18: auto-dispatch pending Outbox rows in "auto" mode ──
  // (approve-mode rows were queued above and wait in the Approvals panel)
  const autoCats = categoryModes(s).filter((c) => c.mode === "auto").map((c) => c.category);
  if (budget > 0 && autoCats.length) {
    const pend = await prisma.outbox.findMany({ where: { status: "pending", category: { in: autoCats } }, orderBy: { createdAt: "asc" }, take: budget });
    for (const o of pend) {
      if (budget <= 0) break;
      if (!o.phone) continue;
      const res = await waSend(o.phone, o.message);
      if (res.ok) {
        await prisma.outbox.update({ where: { id: o.id }, data: { status: "sent", sentAt: new Date() } });
        if (o.clientId) await prisma.communication.create({ data: { clientId: o.clientId, channel: "whatsapp", direction: "outbound", subject: `${o.title} (auto)`, body: o.message, status: "sent" } });
        await prisma.autoSend.create({ data: { category: o.category, clientId: o.clientId, status: "sent", detail: o.dedupeRef } });
        sent++; budget--;
      } else {
        await prisma.outbox.update({ where: { id: o.id }, data: { status: "failed" } });
        await prisma.autoSend.create({ data: { category: o.category, clientId: o.clientId, status: "failed", detail: res.error?.slice(0, 140) } });
        failed++;
      }
    }
  }

  if (sent > 0) {
    await prisma.appSettings.update({ where: { id: "singleton" }, data: { lastAutoSendAt: new Date() } }).catch(() => {});
  }
  return { sent, failed, skipped: null };
}

type SettingsModes = { quoteSendMode: string; winbackMode: string; claimSeqMode: string; delightMode: string };

/** Map each new Outbox category to its current mode setting. */
function categoryModes(s: SettingsModes): { category: TouchCategory; mode: string }[] {
  return [
    { category: "quote", mode: s.quoteSendMode },
    { category: "winback", mode: s.winbackMode },
    { category: "claim", mode: s.claimSeqMode },
    { category: "thankyou", mode: s.delightMode },
    { category: "anniversary", mode: s.delightMode },
  ];
}
