import "server-only";
import { prisma } from "@/lib/db";
import { maybeSnapshot } from "@/lib/snapshots";
import { getDueReminders } from "@/lib/reminders";
import { runAutoSends, autoSentToday } from "@/lib/autosend";
import { scanWatchedFolder } from "@/lib/intake";
import { imapPoll } from "@/lib/imap";
import { waState, waSend } from "@/lib/whatsapp/client";
import { inr, fmtDate } from "@/lib/format";

// ──────────────────────────────────────────────────────────────
// Phase 3 · The automation engine (item 12).
//
// A single in-process ticker that runs while the CRM server is up. We run
// IN-PROCESS on purpose: the app is local-first on one SQLite file, and the
// project's hard-won rule is "only ONE server may touch the DB at a time"
// (a second background process writing the same WAL is what resurrected old
// data before). "Runs with app closed" is achieved the safe way — the launcher
// keeps this one server running (optional login auto-start), so the engine is
// effectively always-on whenever the PC is on, with no second DB writer.
//
// What the tick does today:
//   1. Daily DB snapshot (idempotent — at most one per calendar day).
//   2. Once per day, at the configured hour, send a DIGEST to the AGENT'S OWN
//      WhatsApp number. It NEVER messages clients — client-facing auto-send
//      (item 13) will add its own approve/auto dial behind a separate gate.
//
// Everything here is wrapped so a failure can never crash the server or the
// request that triggered a tick.
// ──────────────────────────────────────────────────────────────

const TICK_MS = 15 * 60_000; // 15 minutes

type EngineGlobal = { started: boolean; timer: NodeJS.Timeout | null; ticking: boolean };
const g = globalThis as unknown as { __engine?: EngineGlobal };
function store(): EngineGlobal {
  if (!g.__engine) g.__engine = { started: false, timer: null, ticking: false };
  return g.__engine;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Start the background ticker once. Safe to call repeatedly (idempotent). */
export function startEngine() {
  const s = store();
  if (s.started) return;
  s.started = true;
  // first tick shortly after boot (let the server settle), then on an interval
  setTimeout(() => void tick(), 20_000);
  s.timer = setInterval(() => void tick(), TICK_MS);
  // don't keep the process alive just for the timer
  s.timer.unref?.();
  console.log("[engine] started (tick every 15m)");
}

/** One engine tick. Never throws. */
export async function tick(): Promise<void> {
  const s = store();
  if (s.ticking) return; // don't overlap a slow tick
  s.ticking = true;
  try {
    // 1) daily snapshot (idempotent)
    await maybeSnapshot();

    // 1b) document auto-intake (item 16): pull mailbox attachments into the
    //     inbox folder, then extract + file everything in it.
    await imapPoll();
    await scanWatchedFolder();

    // 2) client-facing auto-sends for any category set to "auto"
    //    (approve-mode categories do nothing here — they wait for a tap)
    const auto = await runAutoSends();
    if (auto.sent || auto.failed) console.log(`[engine] auto-sent ${auto.sent}, failed ${auto.failed}`);

    // 3) daily digest at the configured hour
    await maybeSendDigest();

    await prisma.appSettings
      .update({ where: { id: "singleton" }, data: { lastEngineTickAt: new Date() } })
      .catch(() => {});
  } catch (e) {
    console.error("[engine] tick failed:", e instanceof Error ? e.message : e);
  } finally {
    s.ticking = false;
  }
}

// ── Daily digest ──────────────────────────────────────────────

const DAY = 86_400_000;

type DigestData = {
  remindersDue: number;
  overdue: { count: number; premium: number };
  dueThisWeek: { count: number; premium: number };
  tasksToday: number;
  text: string;
};

/**
 * Build the morning digest from cheap, proven queries. Deterministic — works
 * with or without an AI key. Returns the ready-to-send WhatsApp text plus the
 * raw counts (used by the Settings "test digest" preview).
 */
export async function buildDigest(): Promise<DigestData> {
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * DAY);

  const [dueReminders, activePolicies, tasksToday, autoSent] = await Promise.all([
    getDueReminders(),
    prisma.policy.findMany({
      where: { status: "active", client: { archivedAt: null } },
      select: { premium: true, renewalDate: true },
    }),
    prisma.task.count({
      where: { done: false, status: { not: "completed" }, dueDate: { lte: endOfToday(now) } },
    }),
    autoSentToday(now),
  ]);

  let overdueCount = 0, overduePrem = 0, weekCount = 0, weekPrem = 0;
  for (const p of activePolicies) {
    const r = p.renewalDate.getTime();
    if (r < now.getTime()) { overdueCount++; overduePrem += p.premium; }
    else if (r <= weekEnd.getTime()) { weekCount++; weekPrem += p.premium; }
  }

  const items: string[] = [];
  if (overdueCount) items.push(`🔴 *${overdueCount} overdue* renewal${overdueCount > 1 ? "s" : ""} · ${inr(overduePrem)} at risk`);
  if (weekCount) items.push(`🟡 *${weekCount} renewal${weekCount > 1 ? "s" : ""} this week* · ${inr(weekPrem)}`);
  if (dueReminders.length) items.push(`💬 *${dueReminders.length} reminder${dueReminders.length > 1 ? "s" : ""}* ready to send`);
  if (tasksToday) items.push(`✅ *${tasksToday} task${tasksToday > 1 ? "s" : ""}* due today`);

  const lines: string[] = [`🌅 *Good morning, Vignesh* — ${fmtDate(now)}`, ""];
  if (items.length) lines.push(...items);
  else lines.push("✨ Nothing overdue and no renewals this week. A clear runway — good day to prospect.");
  if (autoSent) lines.push(`🤖 I auto-sent *${autoSent}* reminder${autoSent > 1 ? "s" : ""} for you so far today.`);
  lines.push("");
  lines.push("Open the CRM to act on these →");

  return {
    remindersDue: dueReminders.length,
    overdue: { count: overdueCount, premium: overduePrem },
    dueThisWeek: { count: weekCount, premium: weekPrem },
    tasksToday,
    text: lines.join("\n"),
  };
}

function endOfToday(now: Date): Date {
  const d = new Date(now);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Resolve the number the digest goes to: explicit setting, else the connected WhatsApp number. */
function digestTarget(agentWhatsApp: string | null): string | null {
  if (agentWhatsApp && agentWhatsApp.trim()) return agentWhatsApp.trim();
  return waState().me; // e.g. "919876543210"
}

/**
 * Send the daily digest to the agent's own WhatsApp — at most once per day,
 * only within the configured hour, only when the engine is enabled and
 * WhatsApp is connected. Records lastDigestOn only on a successful send so a
 * failure retries on the next tick within the same hour.
 */
async function maybeSendDigest(): Promise<void> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!s?.engineEnabled) return;
  if (s.lastDigestOn === todayStr()) return; // already sent today

  const hour = new Date().getHours();
  if (hour < s.digestHour || hour > s.digestHour + 2) return; // send within a 3-hour catch-up window

  if (waState().status !== "ready") return; // can't send; try again next tick
  const to = digestTarget(s.agentWhatsApp);
  if (!to) return;

  const digest = await buildDigest();
  const res = await waSend(to, digest.text);
  if (res.ok) {
    await prisma.appSettings.update({ where: { id: "singleton" }, data: { lastDigestOn: todayStr() } });
    console.log("[engine] daily digest sent");
  } else {
    console.error("[engine] digest send failed:", res.error);
  }
}

/**
 * Send the digest right now, on demand (Settings "Send test digest"). Bypasses
 * the once-a-day / hour guards but still needs WhatsApp connected. Does NOT set
 * lastDigestOn (so the real morning digest still goes out).
 */
export async function sendDigestNow(): Promise<{ ok: boolean; error?: string; preview: string }> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  const digest = await buildDigest();
  if (waState().status !== "ready") {
    return { ok: false, error: "WhatsApp isn't connected — open WhatsApp and Connect first.", preview: digest.text };
  }
  const to = digestTarget(s?.agentWhatsApp ?? null);
  if (!to) return { ok: false, error: "No number to send to — set your WhatsApp number in Settings, or connect WhatsApp.", preview: digest.text };
  const res = await waSend(to, digest.text);
  return { ok: res.ok, error: res.error, preview: digest.text };
}
