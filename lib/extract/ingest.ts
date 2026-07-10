import type { ExtractedDoc } from "./parse";
import { matchDocument, type MatchCandidate, type MatchResult } from "./match";

export const AUTO_THRESHOLD = 90;

export type Decision = {
  status: "attached" | "review" | "unmatched";
  match: MatchResult | null;
};

/** Decide what to do with an extracted document: auto-attach (≥90%), send to
 *  review (a weaker match), or unmatched (nothing plausible). */
export function decide(extracted: ExtractedDoc, candidates: MatchCandidate[], threshold = AUTO_THRESHOLD): Decision {
  const match = matchDocument(extracted, candidates);
  if (!match) return { status: "unmatched", match: null };
  if (match.confidence >= threshold) return { status: "attached", match };
  return { status: "review", match };
}
