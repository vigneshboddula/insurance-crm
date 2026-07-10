import "server-only";
import { prisma } from "@/lib/db";
import { inr } from "@/lib/format";

// ──────────────────────────────────────────────────────────────
// Phase 3 · items 17 & 18 — the "what should go out" generators.
//
// Each function reads the book and returns the client touches that are DUE
// right now for its category. They never send — lib/autosend.ts decides
// approve (queue to the Approvals panel) vs auto (send within limits), and
// dedupes on `dedupeRef` so nothing repeats. Pure, cheap, deterministic.
// ──────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const SIGN = "\n— Vignesh";

export type TouchCategory = "quote" | "winback" | "claim" | "thankyou" | "anniversary";

export type Touch = {
  category: TouchCategory;
  clientId?: string | null;
  leadId?: string | null;
  phone: string | null;
  title: string; // short label for the Approvals panel
  message: string;
  docId?: string | null;
  dedupeRef: string;
};

function fmt(d: Date) { return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
const NCB_LINES = new Set(["health", "motor"]);

// ── item 17: quote follow-up autopilot (day 2 / 5 / 10) ───────
const QUOTE_DAYS = [2, 5, 10] as const;

export async function dueQuoteFollowups(now = new Date()): Promise<Touch[]> {
  const leads = await prisma.lead.findMany({ where: { stage: "quoted", quotedAt: { not: null }, phone: { not: null } } });
  const out: Touch[] = [];
  for (const l of leads) {
    if (!l.phone || !l.quotedAt) continue;
    const days = Math.floor((now.getTime() - l.quotedAt.getTime()) / DAY);
    // the latest touchpoint whose day has arrived (avoids back-filling a burst)
    const t = [...QUOTE_DAYS].reverse().find((d) => days >= d);
    if (!t) continue;
    const prem = l.expectedPremium ? ` (around ${inr(l.expectedPremium)})` : "";
    const msg =
      t === 2 ? `Hi ${l.name}, just following up on the ${l.interest ?? "insurance"} quote${prem} I shared. Happy to walk you through the cover and answer any questions — shall we take it forward?`
      : t === 5 ? `Hi ${l.name}, checking in on the quote I sent. If the premium or plan needs tweaking I can rework it for you — I'd love to get your cover in place.`
      : `Hi ${l.name}, last nudge on your ${l.interest ?? "insurance"} quote — I don't want you to stay unprotected. If now isn't right, tell me when to check back and I'll hold the details ready.`;
    out.push({ category: "quote", leadId: l.id, phone: l.phone, title: `Quote follow-up · day ${t} · ${l.name}`, message: msg + SIGN, dedupeRef: `quote:${l.id}:d${t}` });
  }
  return out;
}

// ── item 17: lapsed-client win-back ───────────────────────────
export async function dueWinbacks(now = new Date()): Promise<Touch[]> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { gracePeriodDays: true } });
  const grace = settings?.gracePeriodDays ?? 15;
  const policies = await prisma.policy.findMany({
    where: { status: { in: ["active", "lapsed"] }, client: { archivedAt: null } },
    include: { client: { select: { id: true, name: true, phone: true } } },
  });
  const out: Touch[] = [];
  for (const p of policies) {
    const lapsedSince = now.getTime() - (p.renewalDate.getTime() + grace * DAY);
    // lapsed past the grace window, but within ~120 days (still worth winning back)
    if (lapsedSince <= 0 || lapsedSince > 120 * DAY) continue;
    if (!p.client.phone) continue;
    const ncb = NCB_LINES.has(p.line) && p.ncbValue ? ` You'd also been building a no-claim bonus worth ${inr(p.ncbValue)} — I may still be able to protect part of it.` : "";
    const msg = `Hi ${p.client.name}, your ${p.carrier} ${p.line} policy ${p.policyNumber} lapsed after ${fmt(p.renewalDate)} and you're currently without cover.${ncb} A short break can often still be fixed — can I help you restart it this week so you're protected again?`;
    out.push({ category: "winback", clientId: p.client.id, phone: p.client.phone, title: `Win-back · ${p.client.name} · ${p.carrier}`, message: msg + SIGN, dedupeRef: `winback:${p.id}:${p.renewalDate.toISOString().slice(0, 10)}` });
  }
  return out;
}

// ── item 18: claim hand-holding sequence ──────────────────────
const CLAIM_STEP: Record<string, string> = {
  intimated: "I've noted your claim and I'm on it. Next we'll need your documents — I'll send you the exact list so nothing bounces back. You won't have to chase anyone; I'll handle the follow-ups.",
  documents: "Thanks — your claim documents are in. I'm submitting them to the insurer and will track the file personally. I'll update you the moment they move it forward.",
  processing: "Quick update: your claim is under processing with the insurer. These take a little time — I'm following up regularly and will tell you the instant there's a decision. Hang in there.",
};

export async function dueClaimTouches(): Promise<Touch[]> {
  const claims = await prisma.claim.findMany({
    where: { status: { in: ["intimated", "documents", "processing"] } },
    include: { client: { select: { id: true, name: true, phone: true } } },
  });
  const out: Touch[] = [];
  for (const c of claims) {
    const step = CLAIM_STEP[c.status];
    if (!step || !c.client.phone) continue;
    const ref = c.claimNumber ? ` (claim ${c.claimNumber})` : "";
    out.push({ category: "claim", clientId: c.client.id, phone: c.client.phone, title: `Claim · ${c.status} · ${c.client.name}`, message: `Hi ${c.client.name},${ref} ${step}` + SIGN, dedupeRef: `claim:${c.id}:${c.status}` });
  }
  return out;
}

// ── item 18: post-renewal thank-you + referral ask ────────────
export async function duePostRenewalThankyous(now = new Date()): Promise<Touch[]> {
  const since = new Date(now.getTime() - 3 * DAY);
  const renewals = await prisma.renewal.findMany({
    where: { status: "renewed", renewedAt: { gte: since } },
    include: { policy: { include: { client: { select: { id: true, name: true, phone: true } } } } },
  });
  const out: Touch[] = [];
  for (const r of renewals) {
    const c = r.policy.client;
    if (!c.phone || !r.renewedAt) continue;
    const msg = `Hi ${c.name}, your ${r.policy.carrier} policy ${r.policy.policyNumber} is renewed and your cover continues uninterrupted — thank you for your trust! If you know a friend or family member who'd like the same peace of mind, a quick introduction means a lot and I'll take good care of them.`;
    out.push({ category: "thankyou", clientId: c.id, phone: c.phone, title: `Thank-you + referral · ${c.name}`, message: msg + SIGN, dedupeRef: `thankyou:${r.policyId}:${r.renewedAt.toISOString().slice(0, 10)}` });
  }
  return out;
}

// ── item 18: policy anniversary value recap ───────────────────
export async function dueAnniversaries(now = new Date()): Promise<Touch[]> {
  const policies = await prisma.policy.findMany({
    where: { status: "active", firstInception: { not: null }, client: { archivedAt: null } },
    include: { client: { select: { id: true, name: true, phone: true } } },
  });
  const out: Touch[] = [];
  const mo = now.getMonth(), da = now.getDate(), yr = now.getFullYear();
  for (const p of policies) {
    const fi = p.firstInception!;
    if (fi.getMonth() !== mo || fi.getDate() !== da) continue;
    const years = yr - fi.getFullYear();
    if (years < 1 || !p.client.phone) continue;
    const msg = `Hi ${p.client.name}, it's ${years} year${years > 1 ? "s" : ""} today since you started your ${p.carrier} ${p.line} policy — thank you for staying protected with me. You currently hold cover of ${inr(p.sumAssured)}. If your needs have changed, it's a good moment for a quick review — I'm here whenever you like.`;
    out.push({ category: "anniversary", clientId: p.client.id, phone: p.client.phone, title: `${years}-yr anniversary · ${p.client.name}`, message: msg + SIGN, dedupeRef: `anniv:${p.id}:${yr}` });
  }
  return out;
}

/** All new-category touches due right now, honoring each category's mode. */
export async function collectDueTouches(modes: {
  quote: string; winback: string; claim: string; delight: string;
}, now = new Date()): Promise<Record<TouchCategory, Touch[]>> {
  const [quote, winback, claim, thankyou, anniversary] = await Promise.all([
    modes.quote !== "off" ? dueQuoteFollowups(now) : Promise.resolve([]),
    modes.winback !== "off" ? dueWinbacks(now) : Promise.resolve([]),
    modes.claim !== "off" ? dueClaimTouches() : Promise.resolve([]),
    modes.delight !== "off" ? duePostRenewalThankyous(now) : Promise.resolve([]),
    modes.delight !== "off" ? dueAnniversaries(now) : Promise.resolve([]),
  ]);
  return { quote, winback, claim, thankyou, anniversary };
}
