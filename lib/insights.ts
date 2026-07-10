import { prisma } from "@/lib/db";
import { upcomingFestivals } from "@/lib/festivals";

// ──────────────────────────────────────────────────────────────
// Dashboard insights engine.
// Everything here is computed from REAL data with transparent heuristics.
// The four "AI" surfaces (briefing, smart actions, cross-sell, lapse risk)
// are tagged `preview: true` — in Phase 4 the heuristic is swapped for a
// real Claude call behind the same return shape, with no UI rework.
// ──────────────────────────────────────────────────────────────

const DAY = 86_400_000;
function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysUntil(d: Date, from = new Date()) {
  return Math.round((startOfDay(d).getTime() - startOfDay(from).getTime()) / DAY);
}
function sameMonthDayWithin(dob: Date, from: Date, within: number) {
  // days until the next occurrence of this month/day (birthday/anniversary)
  const y = from.getFullYear();
  let next = new Date(y, dob.getMonth(), dob.getDate());
  if (next < startOfDay(from)) next = new Date(y + 1, dob.getMonth(), dob.getDate());
  const d = daysUntil(next, from);
  return d >= 0 && d <= within ? d : null;
}

// rough first-year commission rates by line, for opportunity sizing
const COMMISSION_RATE: Record<string, number> = { term: 0.3, life: 0.08, health: 0.15 };
// suggested annual premium for a NEW policy, by income band & line
const SUGGESTED_PREMIUM: Record<string, Record<string, number>> = {
  health: { "<5L": 12000, "5-10L": 18000, "10-25L": 28000, "25L+": 40000 },
  term: { "<5L": 9000, "5-10L": 15000, "10-25L": 24000, "25L+": 38000 },
};

const GOAL = { renewalsPerDay: 2, followUpsPerDay: 6, newBusinessPerDay: 1 };
const MONTHLY_PREMIUM_TARGET = 200000;
const MONTHLY_COMMISSION_TARGET = 35000;

export type Range = "today" | "week" | "month";

export async function getDashboardData(range: Range = "week") {
  const now = new Date();
  const today = startOfDay(now);
  const in7 = new Date(today.getTime() + 7 * DAY);
  const in30 = new Date(today.getTime() + 30 * DAY);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // operational horizon driven by the Today / Week / Month filter
  const horizonDays = range === "today" ? 0 : range === "week" ? 7 : 30;
  const horizonEnd = new Date(today.getTime() + horizonDays * DAY + (DAY - 1)); // inclusive end-of-day
  // start of the performance window for the same filter
  const perfStart = range === "today" ? today : range === "week" ? new Date(today.getTime() - 6 * DAY) : monthStart;
  const rangeLabel = range === "today" ? "today" : range === "week" ? "this week" : "this month";

  const [policies, clients, leads, tasks, comms, renewals, settings, documents, ingestDocs, claims] = await Promise.all([
    prisma.policy.findMany({ where: { deletedAt: null, client: { archivedAt: null } }, include: { client: true, commission: true, insuredMembers: { select: { name: true, relation: true, dob: true } } } }),
    prisma.client.findMany({ where: { archivedAt: null, deletedAt: null }, include: { household: true, policies: true } }),
    prisma.lead.findMany(),
    prisma.task.findMany({ include: { client: true } }),
    prisma.communication.findMany({ orderBy: { occurredAt: "desc" } }),
    prisma.renewal.findMany({ include: { policy: { include: { client: true } } } }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    prisma.document.findMany({ where: { deletedAt: null }, select: { policyId: true, type: true } }),
    prisma.ingestDoc.findMany({ where: { status: { in: ["review", "unmatched"] } }, select: { status: true } }),
    prisma.claim.findMany({ where: { client: { archivedAt: null } }, select: { status: true } }),
  ]);
  const bdayOffset = settings?.birthdayMemberOffsetDays ?? 1;
  const endOfToday = new Date(today.getTime() + DAY - 1);

  const active = policies.filter((p) => p.status === "active");
  const overdue = active.filter((p) => p.renewalDate < today);
  const dueThisWeek = active.filter((p) => p.renewalDate >= today && p.renewalDate <= in7);
  const dueThisMonth = active.filter((p) => p.renewalDate >= today && p.renewalDate <= in30);

  // ── KPIs ──
  const kpis = {
    clients: clients.length,
    activePolicies: active.length,
    premiumUnderMgmt: active.reduce((s, p) => s + p.premium, 0),
    commissionReceived: policies.reduce((s, p) => s + (p.commission?.receivedAmount ?? 0), 0),
    overdue: overdue.length,
    dueThisWeek: dueThisWeek.length,
    dueThisMonth: dueThisMonth.length,
    openLeads: leads.filter((l) => !["won", "lost"].includes(l.stage)).length,
    openTasks: tasks.filter((t) => !t.done).length,
  };

  // policies due within the selected horizon (overdue is always in scope)
  const dueWithinHorizon = active.filter((p) => p.renewalDate >= today && p.renewalDate <= horizonEnd);

  // ── Money at risk (scoped to the time filter) ──
  const atRiskPolicies = [...overdue, ...dueWithinHorizon];
  const premiumAtRisk = atRiskPolicies.reduce((s, p) => s + p.premium, 0);
  const commissionAtRisk = atRiskPolicies.reduce(
    (s, p) => s + (p.commission?.expectedAmount ?? p.premium * (COMMISSION_RATE[p.line] ?? 0.1)),
    0
  );
  const moneyAtRisk = {
    premiumAtRisk,
    commissionAtRisk: Math.round(commissionAtRisk),
    count: atRiskPolicies.length,
    overdueCount: overdue.length,
    level: (premiumAtRisk > 60000 ? "urgent" : premiumAtRisk > 25000 ? "warn" : "calm") as
      | "urgent"
      | "warn"
      | "calm",
    items: atRiskPolicies
      .map((p) => ({
        id: p.id,
        clientId: p.clientId,
        name: p.client.name,
        phone: p.client.phone,
        line: p.line,
        carrier: p.carrier,
        premium: p.premium,
        days: daysUntil(p.renewalDate),
      }))
      .sort((a, b) => a.days - b.days),
  };

  // ── Book Health score ──
  const totalPolicies = policies.length || 1;
  const persistency = Math.round((active.length / totalPolicies) * 100);
  const timeliness = active.length
    ? Math.round(((active.length - overdue.length) / active.length) * 100)
    : 100;
  const avgPoliciesPerClient = clients.length ? active.length / clients.length : 0;
  const crossSellScore = Math.min(100, Math.round((avgPoliciesPerClient / 2.5) * 100));
  const wonLost = leads.filter((l) => ["won", "lost"].includes(l.stage)).length;
  const funnel =
    leads.length === 0
      ? 60
      : Math.round(
          ((leads.filter((l) => l.stage === "won").length * 1 +
            leads.filter((l) => l.stage === "quoted").length * 0.6 +
            leads.filter((l) => l.stage === "contacted").length * 0.3) /
            leads.length) *
            100
        );
  const commsLast7 = comms.filter((c) => c.occurredAt >= new Date(today.getTime() - 7 * DAY)).length;
  // streak: consecutive days up to today with at least one communication
  const commDays = new Set(comms.map((c) => startOfDay(c.occurredAt).getTime()));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    if (commDays.has(today.getTime() - i * DAY)) streak++;
    else if (i > 0) break;
  }
  const activityScore = Math.min(100, Math.round((streak / 14) * 60 + Math.min(commsLast7, 5) * 8));

  const sub = [
    { label: "Persistency", score: persistency, weight: 0.25, hint: "Active vs. total policies" },
    { label: "Renewal timeliness", score: timeliness, weight: 0.25, hint: "On-track vs. overdue" },
    { label: "Cross-sell depth", score: crossSellScore, weight: 0.2, hint: "Avg policies per client" },
    { label: "Lead conversion", score: funnel, weight: 0.15, hint: "Pipeline funnel health" },
    { label: "Activity", score: activityScore, weight: 0.15, hint: "Touchpoints kept up" },
  ];
  const healthScore = Math.round(sub.reduce((s, x) => s + x.score * x.weight, 0));
  const renewedThisMonth = renewals.filter((r) => r.renewedAt && r.renewedAt >= monthStart).length;
  const newThisMonth = policies.filter((p) => p.createdAt >= monthStart).length;
  const trendDelta = Math.max(-10, Math.min(10, newThisMonth + renewedThisMonth * 2 - overdue.length));
  const bookHealth = { score: healthScore, sub, trendDelta };

  // ── Activity rings ──
  const renewalsClosedToday = renewals.filter(
    (r) => r.status === "renewed" && r.renewedAt && r.renewedAt >= today
  ).length;
  const followUpsDoneToday = tasks.filter((t) => t.done && t.createdAt >= today).length;
  const newBusinessToday =
    leads.filter((l) => l.createdAt >= today).length + policies.filter((p) => p.createdAt >= today).length;
  const rings = {
    streak,
    rings: [
      { label: "Renewals closed", value: renewalsClosedToday, goal: GOAL.renewalsPerDay, color: "#0e9f6e" },
      { label: "Follow-ups done", value: followUpsDoneToday, goal: GOAL.followUpsPerDay, color: "#4f46e5" },
      { label: "New business", value: newBusinessToday, goal: GOAL.newBusinessPerDay, color: "#e8930c" },
    ],
  };

  // ── Smart action list (ranked) ──
  type SA = {
    id: string;
    title: string;
    reason: string;
    clientId?: string;
    phone?: string;
    kind: "whatsapp" | "call" | "log";
    tone: "red" | "amber" | "accent" | "green";
    value?: number;
    score: number;
    meta: string;
  };
  const actions: SA[] = [];
  for (const p of overdue) {
    const d = Math.abs(daysUntil(p.renewalDate));
    actions.push({
      id: "od-" + p.id,
      title: `Chase ${p.client.name}'s renewal`,
      reason: `Overdue ${d} days — ₹${p.premium.toLocaleString("en-IN")} premium at risk right now`,
      clientId: p.clientId,
      phone: p.client.phone,
      kind: "whatsapp",
      tone: "red",
      value: p.premium,
      meta: `${p.carrier} · ${p.line.toUpperCase()}`,
      score: 100 + d + p.premium / 10000,
    });
  }
  for (const p of dueWithinHorizon) {
    const d = daysUntil(p.renewalDate);
    actions.push({
      id: "dw-" + p.id,
      title: d === 0 ? `Remind ${p.client.name} — renewal due today` : `Remind ${p.client.name} — renewal in ${d}d`,
      reason: `₹${p.premium.toLocaleString("en-IN")} due ${d <= 1 ? "very soon" : rangeLabel}; a nudge keeps it on track`,
      clientId: p.clientId,
      phone: p.client.phone,
      kind: "whatsapp",
      tone: "amber",
      value: p.premium,
      meta: `${p.carrier} · ${p.line.toUpperCase()}`,
      score: 70 - d + p.premium / 20000,
    });
  }
  for (const l of leads.filter((l) => l.stage === "quoted")) {
    actions.push({
      id: "ld-" + l.id,
      title: `Close ${l.name}`,
      reason: `Hot lead — already quoted${l.expectedPremium ? `, ~₹${l.expectedPremium.toLocaleString("en-IN")} premium` : ""}. Worth a nudge today`,
      phone: l.phone ?? undefined,
      kind: "call",
      tone: "accent",
      value: l.expectedPremium ?? undefined,
      meta: `Lead · ${l.interest ?? "—"}`,
      score: 60 + (l.expectedPremium ?? 0) / 5000,
    });
  }
  for (const t of tasks.filter((t) => !t.done && t.dueDate <= horizonEnd)) {
    const d = daysUntil(t.dueDate);
    actions.push({
      id: "tk-" + t.id,
      title: t.title,
      reason: d < 0 ? `Follow-up overdue ${Math.abs(d)}d` : d === 0 ? "Due today" : `Due in ${d}d`,
      clientId: t.clientId ?? undefined,
      phone: t.client?.phone,
      kind: "call",
      tone: d < 0 ? "red" : "accent",
      meta: "Task",
      score: 50 - d,
    });
  }
  for (const c of clients) {
    if (c.dob) {
      const isProposer = c.policies.length > 0;
      const triggerDay = isProposer ? 0 : bdayOffset; // proposer: on the day; member: N days before
      const bd = sameMonthDayWithin(c.dob, today, Math.max(triggerDay, 1));
      if (bd !== null && bd <= triggerDay)
        actions.push({
          id: "bd-" + c.id,
          title: `Wish ${c.name} a happy birthday`,
          reason: bd === 0 ? "Birthday is today 🎂 — send a warm message" : `Birthday in ${bd}d (greet ${isProposer ? "on the day" : "early as a family member"})`,
          clientId: c.id,
          phone: c.phone,
          kind: "whatsapp",
          tone: "green",
          meta: "Birthday",
          score: 40 - bd,
        });
    }
  }
  const smartActions = actions
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((a) => ({ ...a, priority: Math.max(1, Math.min(100, Math.round(a.score))) }));
  const nextBestAction = smartActions[0] ?? null;

  // ── Cross-sell opportunities (household coverage gaps) ──
  type CS = {
    clientId: string;
    name: string;
    has: string[];
    recommend: string;
    estPremium: number;
    estCommission: number;
    reason: string;
  };
  const crossItems: CS[] = [];
  for (const c of clients) {
    const lines = new Set(c.policies.filter((p) => p.status === "active").map((p) => p.line));
    if (lines.size === 0) continue;
    const band = c.incomeBand ?? "5-10L";
    const age = c.dob ? today.getFullYear() - c.dob.getFullYear() : 40;
    if ((lines.has("term") || lines.has("life")) && !lines.has("health")) {
      const est = SUGGESTED_PREMIUM.health[band] ?? 18000;
      crossItems.push({
        clientId: c.id,
        name: c.name,
        has: [...lines],
        recommend: "health",
        estPremium: est,
        estCommission: Math.round(est * COMMISSION_RATE.health),
        reason: "Has life cover but no health — a hospitalisation gap most families want closed",
      });
    } else if (lines.has("health") && !lines.has("term") && !lines.has("life") && age < 55) {
      const est = SUGGESTED_PREMIUM.term[band] ?? 15000;
      crossItems.push({
        clientId: c.id,
        name: c.name,
        has: [...lines],
        recommend: "term",
        estPremium: est,
        estCommission: Math.round(est * COMMISSION_RATE.term),
        reason: "Health-only — no income protection for the family if something happens",
      });
    }
  }
  crossItems.sort((a, b) => b.estCommission - a.estCommission);
  const crossSell = {
    items: crossItems.slice(0, 4),
    totalPremium: crossItems.reduce((s, x) => s + x.estPremium, 0),
    totalCommission: crossItems.reduce((s, x) => s + x.estCommission, 0),
  };

  // ── Lapse-risk radar ──
  type LR = { clientId: string; name: string; phone: string; level: "high" | "medium" | "low"; score: number; reason: string };
  const lapseItems: LR[] = [];
  const lastCommByClient = new Map<string, Date>();
  for (const c of comms) if (!lastCommByClient.has(c.clientId)) lastCommByClient.set(c.clientId, c.occurredAt);
  for (const c of clients) {
    let score = 0;
    const reasons: string[] = [];
    const od = overdue.filter((p) => p.clientId === c.id);
    if (od.length) {
      score += 50 + Math.min(30, Math.abs(daysUntil(od[0].renewalDate)));
      reasons.push(`renewal overdue ${Math.abs(daysUntil(od[0].renewalDate))}d`);
    }
    if ((c.tags ?? "").includes("lapse-risk")) {
      score += 20;
      reasons.push("flagged lapse-risk");
    }
    const manual = c.policies.some((p) => ["cheque", "cash", "agent"].includes(p.paymentMode) && p.status === "active");
    if (manual) {
      score += 12;
      reasons.push("manual payment mode");
    }
    const last = lastCommByClient.get(c.id);
    const noContactDays = last ? daysUntil(new Date(), last) * -1 : 999;
    if (noContactDays > 60) {
      score += 18;
      reasons.push(last ? `no contact in ${noContactDays}d` : "never contacted");
    }
    if (score > 0)
      lapseItems.push({
        clientId: c.id,
        name: c.name,
        phone: c.phone,
        score,
        level: score >= 70 ? "high" : score >= 35 ? "medium" : "low",
        reason: reasons.join(" · "),
      });
  }
  lapseItems.sort((a, b) => b.score - a.score);
  const lapseRisk = lapseItems.slice(0, 5);

  // ── Renewal runway (next 90 days, by week) ──
  const runway: { weekStart: string; label: string; count: number; premium: number }[] = [];
  for (let w = 0; w < 13; w++) {
    const ws = new Date(today.getTime() + w * 7 * DAY);
    const we = new Date(ws.getTime() + 7 * DAY);
    const inWeek = active.filter((p) => p.renewalDate >= ws && p.renewalDate < we);
    runway.push({
      weekStart: ws.toISOString(),
      label: ws.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      count: inWeek.length,
      premium: inWeek.reduce((s, p) => s + p.premium, 0),
    });
  }
  const runwayMax = Math.max(1, ...runway.map((r) => r.count));

  // ── Book composition ──
  const byLine = groupSum(active, (p) => p.line);
  const byCarrier = groupSum(active, (p) => p.carrier);
  const composition = {
    byLine: byLine,
    byCarrier: byCarrier,
    total: active.length,
  };

  // ── Relationship radar (birthdays, anniversaries, festivals) ──
  type RR = { type: "birthday" | "anniversary" | "festival"; label: string; sub: string; days: number; clientId?: string; phone?: string; emoji: string; greeting?: string };
  const radar: RR[] = [];
  const seenBday = new Set<string>();
  for (const c of clients) {
    if (c.dob) {
      const d = sameMonthDayWithin(c.dob, today, 30);
      if (d !== null) { radar.push({ type: "birthday", label: c.name, sub: "Birthday", days: d, clientId: c.id, phone: c.phone, emoji: "🎂", greeting: "Happy Birthday" }); seenBday.add(c.name.toLowerCase()); }
    }
  }
  // family members' birthdays (captured on policies) — greet the policyholder N days early
  for (const p of active) {
    for (const m of p.insuredMembers) {
      if (!m.dob) continue;
      const key = m.name.toLowerCase();
      if (seenBday.has(key)) continue;
      const d = sameMonthDayWithin(m.dob, today, 30);
      if (d === null) continue;
      seenBday.add(key);
      radar.push({ type: "birthday", label: m.name, sub: `${m.relation ?? "family"} of ${p.client.name}`, days: d, clientId: p.clientId, phone: p.client.phone, emoji: "🎂", greeting: "Happy Birthday" });
    }
  }
  for (const p of active) {
    const d = sameMonthDayWithin(p.startDate, today, 30);
    if (d !== null && d > 0) radar.push({ type: "anniversary", label: p.client.name, sub: `${p.carrier} policy anniversary`, days: d, clientId: p.clientId, phone: p.client.phone, emoji: "📅", greeting: "Policy anniversary" });
  }
  for (const f of upcomingFestivals(today, 60)) {
    radar.push({ type: "festival", label: f.name, sub: "Festival — greet your clients", days: daysUntil(new Date(f.date + "T00:00:00")), emoji: f.emoji, greeting: f.greeting });
  }
  radar.sort((a, b) => a.days - b.days);
  const relationshipRadar = radar.slice(0, 6);

  // ── Goal & momentum ──
  const premiumThisMonth =
    policies.filter((p) => p.startDate >= monthStart).reduce((s, p) => s + p.premium, 0) +
    renewals.filter((r) => r.renewedAt && r.renewedAt >= monthStart).reduce((s, r) => s + r.amount, 0);
  const commissionThisMonth = policies
    .filter((p) => p.commission?.payoutDate && p.commission.payoutDate >= monthStart)
    .reduce((s, p) => s + (p.commission?.receivedAmount ?? 0), 0);
  const projectedPremium = premiumThisMonth + dueThisWeek.reduce((s, p) => s + p.premium, 0);
  const bookLifetimeValue = active.reduce(
    (s, p) => s + (p.commission?.expectedAmount ?? p.premium * (COMMISSION_RATE[p.line] ?? 0.1)),
    0
  );
  const goal = {
    premiumTarget: MONTHLY_PREMIUM_TARGET,
    premiumAchieved: premiumThisMonth,
    premiumProjected: projectedPremium,
    commissionTarget: MONTHLY_COMMISSION_TARGET,
    commissionAchieved: commissionThisMonth,
    bookLifetimeValue: Math.round(bookLifetimeValue),
  };

  // ── Morning briefing (conversational, real numbers, linkable) ──
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  type BItem = { text: string; href?: string; tone: "red" | "amber" | "accent" | "green" | "neutral" };
  const briefing: BItem[] = [];
  if (overdue.length) {
    const worst = [...overdue].sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime())[0];
    briefing.push({
      text: `₹${premiumAtRisk.toLocaleString("en-IN")} of premium is at risk across ${overdue.length} overdue renewal${overdue.length > 1 ? "s" : ""} — chase ${worst.client.name} first (${Math.abs(daysUntil(worst.renewalDate))} days overdue).`,
      href: `/clients`,
      tone: "red",
    });
  }
  if (dueThisWeek.length) {
    briefing.push({
      text: `${dueThisWeek.length} more renewal${dueThisWeek.length > 1 ? "s" : ""} land this week worth ₹${dueThisWeek.reduce((s, p) => s + p.premium, 0).toLocaleString("en-IN")}.`,
      href: `/renewals`,
      tone: "amber",
    });
  }
  const nextRadar = relationshipRadar.find((r) => r.type !== "festival" && r.days <= 7);
  if (nextRadar)
    briefing.push({
      text: `${nextRadar.label}'s ${nextRadar.sub.toLowerCase()} is ${nextRadar.days === 0 ? "today" : `in ${nextRadar.days} day${nextRadar.days > 1 ? "s" : ""}`} — a nice moment to check in.`,
      tone: "green",
    });
  const hotLead = leads.find((l) => l.stage === "quoted");
  if (hotLead)
    briefing.push({
      text: `${hotLead.name} is your hottest lead — already quoted${hotLead.expectedPremium ? ` at ₹${hotLead.expectedPremium.toLocaleString("en-IN")}` : ""}. Worth closing today.`,
      href: `/leads`,
      tone: "accent",
    });
  if (crossSell.totalCommission > 0)
    briefing.push({
      text: `There's ₹${crossSell.totalCommission.toLocaleString("en-IN")} of commission sitting in cross-sell gaps across your book.`,
      tone: "neutral",
    });

  // ── Account priority score (composite: at-risk premium + overdue age + quote value + cross-sell + recency) ──
  const crossByClient = new Map(crossItems.map((c) => [c.clientId, c.estCommission]));
  type PA = { id: string; name: string; phone?: string; score: number; premiumAtRisk: number; overdueAge: number; quoteValue: number; tags: string[] };
  const priorityList: PA[] = [];
  for (const c of clients) {
    const od = overdue.filter((p) => p.clientId === c.id);
    const soon = dueWithinHorizon.filter((p) => p.clientId === c.id);
    const premAtRisk = [...od, ...soon].reduce((s, p) => s + p.premium, 0);
    const overdueAge = od.length ? Math.max(...od.map((p) => Math.abs(daysUntil(p.renewalDate)))) : 0;
    const crossComm = crossByClient.get(c.id) ?? 0;
    const last = lastCommByClient.get(c.id);
    const noContact = last ? daysUntil(now, last) : 999;
    const hasActive = c.policies.some((p) => p.status === "active");
    const raw = premAtRisk / 2000 + overdueAge * 1.2 + crossComm / 400 + (hasActive && noContact > 60 ? 8 : 0);
    if (raw < 0.5) continue;
    const tags: string[] = [];
    if (premAtRisk > 0) tags.push(`₹${premAtRisk.toLocaleString("en-IN")} at risk`);
    if (overdueAge > 0) tags.push(`${overdueAge}d overdue`);
    if (crossComm > 0) tags.push(`cross-sell ₹${crossComm.toLocaleString("en-IN")}`);
    if (hasActive && noContact > 60) tags.push(`cold ${noContact}d`);
    priorityList.push({ id: c.id, name: c.name, phone: c.phone, score: Math.min(100, Math.round(raw)), premiumAtRisk: premAtRisk, overdueAge, quoteValue: 0, tags });
  }
  for (const l of leads.filter((l) => l.stage === "quoted")) {
    const ageDays = daysUntil(now, l.createdAt);
    const raw = (l.expectedPremium ?? 0) / 2000 + ageDays * 0.4;
    priorityList.push({ id: "lead-" + l.id, name: l.name, phone: l.phone ?? undefined, score: Math.min(100, Math.round(raw)), premiumAtRisk: 0, overdueAge: 0, quoteValue: l.expectedPremium ?? 0, tags: [`quote ₹${(l.expectedPremium ?? 0).toLocaleString("en-IN")}`, `${ageDays}d old`] });
  }
  const priorityAccounts = priorityList.sort((a, b) => b.score - a.score).slice(0, 6);

  // ── Alerts (high-value overdue, stale quotes) ──
  type Alert = { id: string; severity: "high" | "medium"; title: string; detail: string; phone?: string; clientId?: string };
  const alerts: Alert[] = [];
  for (const p of overdue.filter((p) => p.premium >= 20000)) {
    alerts.push({ id: "hv-" + p.id, severity: "high", title: `High-value overdue · ${p.client.name}`, detail: `₹${p.premium.toLocaleString("en-IN")} · ${Math.abs(daysUntil(p.renewalDate))}d overdue · ${p.carrier}`, phone: p.client.phone, clientId: p.clientId });
  }
  for (const l of leads.filter((l) => l.stage === "quoted" && daysUntil(now, l.createdAt) >= 2)) {
    alerts.push({ id: "sq-" + l.id, severity: "medium", title: `Quote not followed up · ${l.name}`, detail: `Quoted ${daysUntil(now, l.createdAt)}d ago, no follow-up logged${l.expectedPremium ? ` · ₹${l.expectedPremium.toLocaleString("en-IN")}` : ""}`, phone: l.phone ?? undefined });
  }

  // ── Performance scorecard (scoped to the time filter) ──
  const inPerf = (d: Date) => d >= perfStart;
  const performance = {
    rangeLabel,
    callsMade: comms.filter((c) => c.channel === "call" && inPerf(c.occurredAt)).length,
    renewalsSaved: renewals.filter((r) => r.status === "renewed" && r.renewedAt && inPerf(r.renewedAt)).length,
    quotesSent: leads.filter((l) => l.stage === "quoted" && inPerf(l.createdAt)).length,
    premiumSecured:
      renewals.filter((r) => r.status === "renewed" && r.renewedAt && inPerf(r.renewedAt)).reduce((s, r) => s + r.amount, 0) +
      policies.filter((p) => inPerf(p.startDate)).reduce((s, p) => s + p.premium, 0),
  };

  // ── Pipeline funnel ──
  const STAGES: { key: string; label: string }[] = [
    { key: "new", label: "New" }, { key: "contacted", label: "Contacted" }, { key: "quoted", label: "Quoted" }, { key: "won", label: "Won" }, { key: "lost", label: "Lost" },
  ];
  const pipeline = STAGES.map((s) => ({
    stage: s.label,
    count: leads.filter((l) => l.stage === s.key).length,
    value: leads.filter((l) => l.stage === s.key).reduce((sum, l) => sum + (l.expectedPremium ?? 0), 0),
  }));

  // ── Operations tiles (renewal workflow health) ──
  const docTypesByPolicy = new Map<string, Set<string>>();
  for (const d of documents) {
    if (!d.policyId) continue;
    const set = docTypesByPolicy.get(d.policyId) ?? new Set<string>();
    set.add(d.type);
    docTypesByPolicy.set(d.policyId, set);
  }
  const dueSoon60 = new Date(today.getTime() + 60 * DAY);
  const dueThisMonthList = active.filter((p) => p.renewalDate >= today && p.renewalDate <= in30);
  const ops = {
    renewalsDueMonth: dueThisMonthList.length,
    premiumExpected: dueThisMonthList.reduce((s, p) => s + p.premium, 0),
    premiumCollected: renewals.filter((r) => r.status === "renewed" && r.renewedAt && r.renewedAt >= monthStart).reduce((s, r) => s + r.amount, 0),
    missingNotice: active.filter((p) => p.renewalDate <= dueSoon60 && !docTypesByPolicy.get(p.id)?.has("renewal_notice")).length,
    missingCopy: active.filter((p) => { const t = docTypesByPolicy.get(p.id); return !t?.has("policy_copy") && !t?.has("policy"); }).length,
    unmatchedDocs: ingestDocs.filter((i) => i.status === "unmatched").length,
    reviewQueue: ingestDocs.length,
  };

  // ── Tasks due today + overdue (dashboard widget) ──
  const tasksDue = tasks
    .filter((t) => !t.done && t.dueDate <= endOfToday)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate.toISOString(),
      overdue: daysUntil(t.dueDate) < 0,
      clientId: t.clientId,
      clientName: t.client?.name ?? null,
      clientPhone: t.client?.phone ?? null,
    }));

  // ── Upcoming & overdue renewals (the kept list, refined) ──
  const upcomingRenewals = [...active]
    .sort((a, b) => a.renewalDate.getTime() - b.renewalDate.getTime())
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      clientId: p.clientId,
      name: p.client.name,
      phone: p.client.phone,
      carrier: p.carrier,
      line: p.line,
      policyNumber: p.policyNumber,
      premium: p.premium,
      renewalDate: p.renewalDate.toISOString(),
      days: daysUntil(p.renewalDate),
    }));

  // ── Top-of-dashboard headline figures (wireframe rebuild) ──
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const renewedRenewals = renewals.filter((r) => r.status === "renewed" && r.renewedAt);
  const securedIn = (from: Date) =>
    policies.filter((p) => p.startDate >= from).reduce((s, p) => s + p.premium, 0) +
    renewedRenewals.filter((r) => r.renewedAt! >= from).reduce((s, r) => s + r.amount, 0);
  const premium = {
    day: Math.round(securedIn(today)),
    month: Math.round(securedIn(monthStart)),
    ytd: Math.round(securedIn(yearStart)),
    underMgmt: kpis.premiumUnderMgmt,
  };
  const lapsedCount = policies.filter((p) => p.status === "lapsed").length;
  const claimsOpen = claims.filter((c) => !["settled", "rejected", "closed"].includes(c.status)).length;
  const newLeadsMonth = leads.filter((l) => l.createdAt >= monthStart).length;
  const leadActions = leads.filter((l) => !["won", "lost"].includes(l.stage)).length;

  const headline = {
    premium,
    newLeadsMonth,
    leadActions,
    renewalsDue: dueThisMonth.length,
    claimsOpen,
  };
  // clickable quick-filter chips (label, count, where they lead)
  const quickFilters = [
    { key: "clients", label: "Clients", count: kpis.clients, href: "/clients" },
    { key: "active", label: "Active Policies", count: kpis.activePolicies, href: "/policies" },
    { key: "aum", label: "Premium Under Mgmt", count: null as number | null, money: kpis.premiumUnderMgmt, href: "/policies" },
    { key: "leads", label: "Open Leads", count: kpis.openLeads, href: "/leads" },
    { key: "lapsed", label: "Lapsed", count: lapsedCount, href: "/renewals" },
    { key: "month", label: "Due This Month", count: kpis.dueThisMonth, href: "/renewals" },
    { key: "overdue", label: "Overdue", count: kpis.overdue, href: "/renewals" },
    { key: "week", label: "Due This Week", count: kpis.dueThisWeek, href: "/renewals" },
  ];

  return {
    generatedAt: now.toISOString(),
    greeting,
    range,
    rangeLabel,
    headline,
    quickFilters,
    nextBestAction,
    priorityAccounts,
    alerts,
    performance,
    pipeline,
    ops,
    tasksDue,
    upcomingRenewals,
    kpis,
    moneyAtRisk,
    bookHealth,
    rings,
    smartActions,
    crossSell,
    lapseRisk,
    runway: { weeks: runway, max: runwayMax },
    composition,
    relationshipRadar,
    goal,
    briefing,
  };
}

function groupSum<T>(items: T[], key: (i: T) => string) {
  const m = new Map<string, { count: number; premium: number }>();
  for (const it of items) {
    const k = key(it);
    const cur = m.get(k) ?? { count: 0, premium: 0 };
    cur.count++;
    cur.premium += (it as { premium?: number }).premium ?? 0;
    m.set(k, cur);
  }
  return [...m.entries()]
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.count - a.count);
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
