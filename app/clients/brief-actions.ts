"use server";

import { prisma } from "@/lib/db";
import { inr, fmtDate, daysUntil } from "@/lib/format";
import { ltvOf, tierOf } from "@/lib/ltv";
import { aiAvailable, complete, MODEL_FAST, PERSONA } from "@/lib/ai";

// Item 25 — pre-meeting brief. Assembles a non-sensitive snapshot of the client
// (never vault data) and returns a crisp brief the agent can read before a call
// or meeting. Uses Claude when a key is present, else a deterministic fallback.

export async function generateBrief(clientId: string): Promise<{ text: string; ai: boolean }> {
  const c = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      policies: { include: { insuredMembers: true } },
      claims: { orderBy: { intimatedAt: "desc" }, take: 5 },
      communications: { orderBy: { occurredAt: "desc" }, take: 5 },
      tasks: { where: { done: false }, orderBy: { dueDate: "asc" } },
    },
  });
  if (!c) return { text: "Client not found.", ai: false };

  const active = c.policies.filter((p) => p.status === "active");
  const ltv = ltvOf(c.policies);
  const tier = tierOf(ltv.annual);
  const nextRen = [...active].sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime())[0];
  const family = [...new Set(c.policies.flatMap((p) => p.insuredMembers.map((m) => m.name)))];
  const openClaims = c.claims.filter((cl) => !["settled", "rejected"].includes(cl.status));
  const lines = ["health", "term", "life", "personal_accident", "motor", "mutual_fund"];
  const held = new Set(active.map((p) => p.line));
  const gaps = lines.filter((l) => !held.has(l) && ["term", "health"].includes(l));
  const lastComm = c.communications[0];

  // Structured facts (non-sensitive) shared by both paths.
  const facts = {
    name: c.name,
    tier: tier.label,
    annualPremium: ltv.annual,
    lifetimeValue: ltv.value,
    tenureYears: ltv.tenureYears,
    policies: active.map((p) => ({ line: p.line, carrier: p.carrier, plan: p.planName, premium: p.premium, sumInsured: p.sumAssured, renews: fmtDate(p.renewalDate), overdue: daysUntil(p.renewalDate) < 0 })),
    nextRenewal: nextRen ? { carrier: nextRen.carrier, date: fmtDate(nextRen.renewalDate), days: daysUntil(nextRen.renewalDate) } : null,
    family,
    openClaims: openClaims.map((cl) => ({ status: cl.status, amount: cl.amount })),
    coverGaps: gaps,
    openTasks: c.tasks.map((t) => t.title),
    lastContact: lastComm ? `${lastComm.channel} on ${fmtDate(lastComm.occurredAt)}` : "no logged contact",
  };

  if (aiAvailable()) {
    try {
      const text = await complete({
        model: MODEL_FAST,
        system: PERSONA + " Write a tight PRE-MEETING BRIEF the agent reads in 20 seconds before calling/meeting this client. 4–7 short bullet points: who they are + value, what's urgent (renewals/claims/tasks), 1–2 cross-sell or review angles, and a suggested opening line. No preamble, no vault data.",
        prompt: `Client facts (non-sensitive):\n${JSON.stringify(facts, null, 2)}`,
        maxTokens: 500,
      });
      if (text.trim()) return { text: text.trim(), ai: true };
    } catch { /* fall through to heuristic */ }
  }

  // Deterministic fallback
  const b: string[] = [];
  b.push(`• ${c.name} — ${tier.label} client, ${inr(ltv.annual)}/yr across ${active.length} polic${active.length === 1 ? "y" : "ies"} (with you ~${ltv.tenureYears}y).`);
  if (nextRen) b.push(`• ${daysUntil(nextRen.renewalDate) < 0 ? "⚠ OVERDUE" : "Next"} renewal: ${nextRen.carrier} on ${fmtDate(nextRen.renewalDate)}.`);
  if (openClaims.length) b.push(`• ${openClaims.length} open claim(s) — status: ${openClaims.map((cl) => cl.status).join(", ")}. Ask how they're doing.`);
  if (family.length) b.push(`• Family covered: ${family.join(", ")}.`);
  if (gaps.length) b.push(`• Cross-sell angle: no ${gaps.join(" or ")} cover on file — worth raising.`);
  if (c.tasks.length) b.push(`• Open tasks: ${c.tasks.map((t) => t.title).join("; ")}.`);
  b.push(`• Last contact: ${facts.lastContact}.`);
  b.push(`• Opener: "Hi ${c.name.split(" ")[0]}, hope you and the family are well — I was reviewing your cover and wanted to check in."`);
  return { text: b.join("\n"), ai: false };
}
