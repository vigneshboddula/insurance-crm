import "server-only";
import { parseDocument, type ExtractedDoc } from "./parse";
import { aiExtractDocument } from "./ai-extract";
import { aiAvailable } from "@/lib/ai";

// The single entry point for document extraction. Strategy:
//   1. Rule-based parse first — free, instant, fully local, and 100% reliable
//      for the insurer formats we've tuned (HDFC ERGO, Care Health).
//   2. If the rules didn't get the key fields AND an AI key is configured,
//      ask Claude to read the whole document and fill the gaps — this makes
//      NEW / unseen insurer formats work without adding per-format rules.
// Rule values always win when present (verified + free); AI only fills blanks,
// so a wrong AI reading can never overwrite a good rule reading.

const iso = (v?: string | null): string | null => {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const posNum = (v: unknown): number | null => (typeof v === "number" && isFinite(v) && v > 0 ? v : null);

/** True when the rule parser already captured EVERYTHING — including members and
 *  the original inception — so an AI call would add nothing. Otherwise we let AI
 *  fill the gaps (family members, first inception, and any unseen format). */
function ruleComplete(e: ExtractedDoc): boolean {
  return !!(
    e.policyNumber && e.premium && e.sumInsured && e.productName &&
    (e.dueDate || e.endDate) && e.firstInception && e.members.length > 0
  );
}

export async function extractDoc(text: string): Promise<ExtractedDoc> {
  const base = parseDocument(text);
  if (ruleComplete(base) || !aiAvailable()) return base;

  const ai = await aiExtractDocument(text);
  if (!ai) return base;

  const members = base.members.length
    ? base.members
    : Array.isArray(ai.members)
      ? ai.members.filter((m) => m?.name).map((m) => ({ name: String(m.name).trim(), relation: m.relation ?? null, age: null, dob: iso(m.dob)?.slice(0, 10) ?? null }))
      : [];

  return {
    ...base,
    insurer: base.insurer ?? ai.insurer ?? null,
    docType: base.docType !== "unknown" ? base.docType : (ai.docType ?? "unknown"),
    policyNumber: base.policyNumber ?? ai.policyNumber ?? null,
    customerName: base.customerName ?? ai.customerName ?? null,
    productName: base.productName ?? ai.productName ?? null,
    premium: base.premium ?? posNum(ai.premium),
    sumInsured: base.sumInsured ?? posNum(ai.sumInsured),
    startDate: base.startDate ?? iso(ai.startDate),
    firstInception: base.firstInception ?? iso(ai.firstInception),
    endDate: base.endDate ?? iso(ai.endDate),
    dueDate: base.dueDate ?? iso(ai.dueDate),
    tenureYears: base.tenureYears ?? (typeof ai.tenureYears === "number" ? ai.tenureYears : null),
    members,
  };
}
