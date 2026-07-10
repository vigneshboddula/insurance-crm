import "server-only";
import { prisma } from "@/lib/db";

// ──────────────────────────────────────────────────────────────
// Builds the book snapshot the assistant reasons over.
// Deliberately excludes ClientVault entirely (Aadhaar/PAN/KYC) — only
// names, contact, and policy/lead/task facts go in. This is the ONLY
// data the assistant is given; it answers from this and nothing else.
// ──────────────────────────────────────────────────────────────

const DAY = 86_400_000;
function daysUntil(d: Date) {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / DAY);
}
function inr(n: number) {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function buildBookContext(): Promise<string> {
  const [clients, policies, leads, tasks] = await Promise.all([
    prisma.client.findMany({
      where: { archivedAt: null },
      include: { household: true, policies: true },
      orderBy: { name: "asc" },
    }),
    prisma.policy.findMany({ where: { client: { archivedAt: null } }, include: { client: true } }),
    prisma.lead.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.task.findMany({ where: { done: false }, include: { client: true }, orderBy: { dueDate: "asc" } }),
  ]);

  const lines: string[] = [];
  lines.push(`BOOK SNAPSHOT (generated ${ymd(new Date())}). These are the only facts you have.`);
  lines.push(`Totals: ${clients.length} policy holders, ${policies.length} policies, ${leads.filter((l) => !["won", "lost"].includes(l.stage)).length} open leads, ${tasks.length} open tasks.`);

  lines.push("\n## POLICY HOLDERS");
  for (const c of clients) {
    const pols = c.policies
      .map((p) => `${p.line}/${p.carrier} ${inr(p.premium)} (${p.status}${p.status === "active" ? `, renews ${ymd(p.renewalDate)}` : ""})`)
      .join("; ");
    lines.push(`- ${c.name}${c.phone ? ` · ${c.phone}` : ""}${c.household ? ` · household: ${c.household.name}` : ""} · policies: ${pols || "none"}`);
  }

  lines.push("\n## RENEWALS (active policies, soonest first)");
  const active = policies.filter((p) => p.status === "active").sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime());
  for (const p of active) {
    const d = daysUntil(p.renewalDate);
    const when = d < 0 ? `${Math.abs(d)}d OVERDUE` : d === 0 ? "due today" : `in ${d}d`;
    lines.push(`- ${p.client.name} · ${p.line}/${p.carrier} · ${inr(p.premium)} · ${ymd(p.renewalDate)} (${when})`);
  }

  lines.push("\n## LEADS");
  for (const l of leads) {
    lines.push(`- ${l.name}${l.phone ? ` · ${l.phone}` : ""} · stage ${l.stage}${l.expectedPremium ? ` · est ${inr(l.expectedPremium)}` : ""}${l.interest ? ` · ${l.interest}` : ""}`);
  }

  lines.push("\n## OPEN TASKS");
  for (const t of tasks.slice(0, 40)) {
    const d = daysUntil(t.dueDate);
    lines.push(`- ${t.title}${t.client ? ` (${t.client.name})` : ""} · due ${ymd(t.dueDate)}${d < 0 ? " (overdue)" : ""} · ${t.priority}`);
  }

  return lines.join("\n");
}

/** Compact facts for one policy holder — used when drafting a message for them. */
export async function clientFacts(clientId: string): Promise<string | null> {
  const c = await prisma.client.findFirst({
    where: { id: clientId, archivedAt: null },
    include: { policies: true },
  });
  if (!c) return null;
  const parts: string[] = [`Name: ${c.name}`];
  if (c.phone) parts.push(`Phone: ${c.phone}`);
  const active = c.policies.filter((p) => p.status === "active").sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime());
  for (const p of active) {
    const d = daysUntil(p.renewalDate);
    parts.push(`Policy: ${p.line} with ${p.carrier}, premium ${inr(p.premium)}, policy no ${p.policyNumber}, renews ${ymd(p.renewalDate)} (${d < 0 ? `${Math.abs(d)} days overdue` : `in ${d} days`})`);
  }
  return parts.join("\n");
}
