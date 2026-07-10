import "server-only";
import { prisma } from "@/lib/db";
import { insurerFor, renewalLinkFor } from "@/lib/insurers";

// ──────────────────────────────────────────────────────────────
// Renewal reminder cadence + grace-period warnings.
// Pre-renewal: 1 month → 1 week → 5d → 3d → 2d → renewal day.
// The 1-month touchpoint carries the payment link + policy copy.
// After the due date: grace-period warnings until the policy lapses.
// A reminder is "due" when its scheduled day has passed and it hasn't been
// sent for the policy's current renewal cycle. Sending is logged in
// RenewalReminder so nothing repeats and everything auto-stops on renewal
// (the renewal date — and thus the cycle — moves forward a year).
// ──────────────────────────────────────────────────────────────

const DAY = 86_400_000;

export type Step = "m1" | "w1" | "d5" | "d3" | "d2" | "due" | "grace1" | "grace2";

type StepDef = { step: Step; offset: number; label: string; grace?: boolean };

/** Build the schedule for a given grace period (offsets in days from renewal date). */
export function schedule(graceDays: number): StepDef[] {
  const g1 = Math.max(2, Math.round(graceDays / 3));
  const g2 = Math.max(g1 + 1, graceDays - 1);
  return [
    { step: "m1", offset: -30, label: "1 month before" },
    { step: "w1", offset: -7, label: "1 week before" },
    { step: "d5", offset: -5, label: "5 days before" },
    { step: "d3", offset: -3, label: "3 days before" },
    { step: "d2", offset: -2, label: "2 days before" },
    { step: "due", offset: 0, label: "Renewal day" },
    { step: "grace1", offset: g1, label: "Grace period — reminder", grace: true },
    { step: "grace2", offset: g2, label: "Grace period — final warning", grace: true },
  ];
}

export const STEP_LABEL: Record<Step, string> = {
  m1: "1 month before", w1: "1 week before", d5: "5 days before", d3: "3 days before",
  d2: "2 days before", due: "Renewal day", grace1: "Grace warning", grace2: "Final grace warning",
};

function inr(n: number) { return "₹" + Math.round(n).toLocaleString("en-IN"); }
function fmt(d: Date) { return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }

// WhatsApp text formatting: *bold*, and a bullet char for steps.
const SIGN = "\n\n— Vignesh\n_Your insurance advisor_";

/** Build the "how to pay" block: renewal link + numbered insurer steps. */
function paymentBlock(carrier: string, policyNumber: string, renewalUrl?: string | null): string {
  const info = insurerFor(carrier);
  const link = renewalLinkFor(carrier, renewalUrl);
  const lines: string[] = [];
  lines.push(`🔗 *Renew here:* ${link ?? "(link will be shared)"}`);
  lines.push(`📄 *Policy number:* ${policyNumber}`);
  lines.push("");
  lines.push("*How to pay — step by step:*");
  info.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  return lines.join("\n");
}

/** The ready-to-send WhatsApp text for a step (deterministic template, agent can edit).
 *  Uses WhatsApp formatting (*bold*, _italic_) + emojis, includes the policy number,
 *  the insurer renewal link, and step-by-step payment instructions. The renewal
 *  notice PDF is attached separately by the send action. */
export function reminderMessage(step: Step, p: { name: string; carrier: string; policyNumber: string; premium: number; renewalDate: Date; graceDays: number; renewalUrl?: string | null; line?: string; ncbValue?: number | null }): string {
  const hi = `Hi ${p.name} 👋`;
  const pay = paymentBlock(p.carrier, p.policyNumber, p.renewalUrl);
  // No-claim bonus is lost on a lapse for health/motor — spell out the rupee value.
  const ncbApplies = (p.line === "health" || p.line === "motor") && !!p.ncbValue;
  const ncbWarn = ncbApplies ? `\n\n⚠️ You'll also lose your accumulated *No-Claim Bonus of ${inr(p.ncbValue!)}* if the policy lapses.` : "";
  const premiumLine = `💰 *Premium:* ${inr(p.premium)}`;
  const dateLine = `📅 *Renewal date:* ${fmt(p.renewalDate)}`;

  switch (step) {
    case "m1":
      return `${hi}\n\nYour *${p.carrier}* health policy is coming up for renewal. 🗓️\n\n${dateLine}\n${premiumLine}\n\nI'm sharing the details early so you have plenty of time. Renewing before the due date keeps your cover and all your benefits (waiting periods, no-claim bonus) continuous. ✅\n\n${pay}${ncbWarn}\n\nI've also attached your renewal notice for reference. Reply here if you'd like me to help. 🙏${SIGN}`;
    case "w1":
      return `${hi}\n\n⏰ A quick reminder — your *${p.carrier}* policy renews *in 1 week*.\n\n${dateLine}\n${premiumLine}\n\n${pay}${ncbWarn}\n\nShall I help you complete it? Just reply here. 😊${SIGN}`;
    case "d5":
    case "d3":
    case "d2": {
      const days = step === "d5" ? 5 : step === "d3" ? 3 : 2;
      return `${hi}\n\n🔔 Your *${p.carrier}* policy renews *in ${days} days*.\n\n${dateLine}\n${premiumLine}\n\nPlease renew soon to avoid any break in your cover.${ncbWarn}\n\n${pay}${SIGN}`;
    }
    case "due":
      return `${hi}\n\n🚨 *Today is your renewal date* for your *${p.carrier}* policy.\n\n${premiumLine}\n\nRenew today to keep your cover active without any interruption.${ncbWarn}\n\n${pay}${SIGN}`;
    case "grace1":
      return `${hi}\n\n⚠️ Your *${p.carrier}* policy crossed its renewal date on ${fmt(p.renewalDate)}. You're now in the *${p.graceDays}-day grace period*.\n\n${premiumLine}\n\nPlease renew now so you don't lose continuity benefits like waiting-period credit.${ncbWarn}\n\n${pay}${SIGN}`;
    case "grace2":
      return `${hi}\n\n🔴 *Final reminder* — your *${p.carrier}* policy grace period is ending soon. After this the policy will *lapse* and you'll have to start fresh.\n\n${premiumLine}\n\nPlease renew immediately — I'm here to help right away. 🙏\n\n${pay}${SIGN}`;
  }
}

/**
 * Record that a renewal reminder went out: the RenewalReminder dedupe row (so
 * it never repeats and auto-stops on renewal) + a Communication history entry.
 * Shared by the manual Send actions and the engine's auto-send so both dedupe
 * and log identically. `via` distinguishes a hand-tapped send from an auto one.
 */
export async function recordReminderSent(one: {
  policyId: string; clientId: string; step: Step; cycleDate: string; message: string; via?: "manual" | "auto";
}) {
  await prisma.renewalReminder.create({
    data: { policyId: one.policyId, cycleDate: new Date(one.cycleDate), step: one.step, scheduledFor: new Date(), channel: one.via === "auto" ? "whatsapp-auto" : "whatsapp" },
  });
  await prisma.communication.create({
    data: { clientId: one.clientId, channel: "whatsapp", direction: "outbound", subject: `Renewal reminder · ${one.step}${one.via === "auto" ? " (auto)" : ""}`, body: one.message, status: "sent" },
  });
}

export type DueReminder = {
  policyId: string; clientId: string; name: string; phone: string | null;
  carrier: string; line: string; policyNumber: string; premium: number;
  renewalDate: string; cycleDate: string; step: Step; stepLabel: string; grace: boolean;
  daysFromDue: number; message: string; noticeDocId: string | null;
};

/** Compute every reminder that is due to be sent right now. */
export async function getDueReminders(): Promise<DueReminder[]> {
  const now = new Date();
  const [settings, policies] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    prisma.policy.findMany({
      where: { status: "active", client: { archivedAt: null }, deletedAt: null },
      include: { client: { select: { id: true, name: true, phone: true } } },
    }),
  ]);
  const graceDays = settings?.gracePeriodDays ?? 15;
  const steps = schedule(graceDays);

  const policyIds = policies.map((p) => p.id);
  const [sent, notices] = await Promise.all([
    prisma.renewalReminder.findMany({ where: { policyId: { in: policyIds } } }),
    prisma.document.findMany({
      where: { policyId: { in: policyIds }, type: "renewal_notice", deletedAt: null },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, policyId: true },
    }),
  ]);
  const sentKey = new Set(sent.map((s) => `${s.policyId}|${s.cycleDate.getTime()}|${s.step}`));
  const noticeByPolicy = new Map<string, string>();
  for (const n of notices) if (n.policyId && !noticeByPolicy.has(n.policyId)) noticeByPolicy.set(n.policyId, n.id);

  const due: DueReminder[] = [];
  for (const p of policies) {
    const R = p.renewalDate.getTime();
    // latest step whose scheduled day has passed
    const passed = steps.filter((s) => R + s.offset * DAY <= now.getTime());
    if (!passed.length) continue;
    const current = passed[passed.length - 1];
    // skip if we're past the grace window entirely (policy effectively lapsed)
    if (now.getTime() > R + graceDays * DAY) continue;
    const key = `${p.id}|${p.renewalDate.getTime()}|${current.step}`;
    if (sentKey.has(key)) continue; // current step already sent
    due.push({
      policyId: p.id, clientId: p.clientId, name: p.client.name, phone: p.client.phone,
      carrier: p.carrier, line: p.line, policyNumber: p.policyNumber, premium: p.premium,
      renewalDate: p.renewalDate.toISOString(), cycleDate: p.renewalDate.toISOString(),
      step: current.step, stepLabel: current.label, grace: !!current.grace,
      daysFromDue: Math.round((now.getTime() - R) / DAY),
      message: reminderMessage(current.step, { name: p.client.name, carrier: p.carrier, policyNumber: p.policyNumber, premium: p.premium, renewalDate: p.renewalDate, graceDays, renewalUrl: p.renewalUrl, line: p.line, ncbValue: p.ncbValue }),
      noticeDocId: noticeByPolicy.get(p.id) ?? null,
    });
  }
  // grace warnings first (most urgent), then by soonest renewal
  return due.sort((a, b) => Number(b.grace) - Number(a.grace) || a.daysFromDue - b.daysFromDue);
}
