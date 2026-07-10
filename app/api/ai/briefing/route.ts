import { NextRequest } from "next/server";
import { aiAvailable, complete, extractJson, PERSONA, MODEL_FAST } from "@/lib/ai";
import { getDashboardData, type Range } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

type Tone = "red" | "amber" | "accent" | "green" | "neutral";
type Item = { text: string; href?: string; tone: Tone };

const TONES: Tone[] = ["red", "amber", "accent", "green", "neutral"];
const HREFS = new Set(["/clients", "/renewals", "/leads", "/tasks", "/policies", "/claims"]);

// Cost guard: cache the AI briefing per (range, day) for a few hours so that
// merely refreshing the dashboard doesn't bill Claude every time. Only
// successful results are cached — a failure falls through to the heuristic.
type Cached = { items: Item[]; at: number };
const TTL_MS = 3 * 60 * 60 * 1000; // 3 hours — refreshes a few times a day, stays same-day fresh
const cache = new Map<string, Cached>();

export async function GET(req: NextRequest) {
  if (!aiAvailable()) return Response.json({ items: null });

  const r = req.nextUrl.searchParams.get("range");
  const range: Range = r === "today" || r === "month" ? r : "week";
  const cacheKey = `${range}:${new Date().toISOString().slice(0, 10)}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return Response.json({ items: hit.items, cached: true });

  try {
    const d = await getDashboardData(range);
    // Feed Claude only pre-computed, non-sensitive figures from the heuristic engine.
    const facts = {
      greeting: d.greeting,
      rangeLabel: d.rangeLabel,
      overdueCount: d.moneyAtRisk.overdueCount,
      premiumAtRisk: d.moneyAtRisk.premiumAtRisk,
      commissionAtRisk: d.moneyAtRisk.commissionAtRisk,
      dueThisWeek: d.kpis.dueThisWeek,
      dueThisMonth: d.kpis.dueThisMonth,
      openLeads: d.kpis.openLeads,
      openTasks: d.kpis.openTasks,
      crossSellCommission: d.crossSell.totalCommission,
      rawBriefing: d.briefing,
      topPriority: d.priorityAccounts.slice(0, 3).map((p) => ({ name: p.name, tags: p.tags })),
      nextRelationship: d.relationshipRadar.find((x) => x.type !== "festival") ?? null,
    };

    const system =
      PERSONA +
      "\n\nWrite Vignesh's morning briefing: the 3–5 things that matter most right now, " +
      "prioritised (money at risk and overdue first). Each line is one warm, specific sentence " +
      "using the real numbers given — don't pad, don't invent. Return ONLY a JSON array of " +
      '{ "text": string, "href"?: string, "tone": "red"|"amber"|"accent"|"green"|"neutral" }. ' +
      'Use href only from this set: "/clients", "/renewals", "/leads", "/tasks". ' +
      "tone: red=overdue/at-risk, amber=due-soon, accent=hot lead, green=relationship moment, neutral=opportunity.";

    const out = await complete({
      system,
      prompt: "Facts:\n" + JSON.stringify(facts, null, 2),
      maxTokens: 900,
      model: MODEL_FAST,
    });

    const parsed = extractJson<Item[]>(out);
    if (!Array.isArray(parsed)) return Response.json({ items: null });

    const items = parsed
      .filter((it) => it && typeof it.text === "string" && it.text.trim())
      .slice(0, 6)
      .map((it) => ({
        text: it.text.trim(),
        href: it.href && HREFS.has(it.href) ? it.href : undefined,
        tone: TONES.includes(it.tone) ? it.tone : "neutral",
      }));

    if (items.length) cache.set(cacheKey, { items, at: Date.now() });
    return Response.json({ items: items.length ? items : null });
  } catch {
    // Any failure → tell the client to keep the heuristic briefing.
    return Response.json({ items: null });
  }
}
