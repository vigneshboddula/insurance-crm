import { validMobile, type ExtractedDoc } from "./parse";

export type MatchCandidate = {
  holderId: string;
  name: string;
  mobile: string | null;
  pehchaan: string | null; // vault Pehchaan / insurer Client ID
  members: string[]; // insured member names across their policies
  policies: { policyId: string; versionId: string | null; numbers: string[] }[]; // current + previous policy numbers
};

export type MatchResult = {
  holderId: string;
  policyId: string | null;
  versionId: string | null;
  confidence: number; // 0-100
  reason: string;
};

const normNo = (s: string) => s.replace(/[^a-z0-9]/gi, "").toUpperCase();

/** Normalize a person's name for comparison: drop titles/punctuation, lowercase,
 *  collapse spaces. Returns "" for a salutation-only or empty name. */
export function normPersonName(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().replace(/\b(mr|mrs|ms|miss|dr|smt|shri|sri)\b/g, "").replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}
/** A name meaningful enough to identify a person (not empty / not a bare title). */
function meaningfulName(s: string | null | undefined): string | null {
  const n = normPersonName(s);
  return n.length >= 2 ? n : null;
}
/** True when two names refer to the same person (title/spacing-insensitive). */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = meaningfulName(a), nb = meaningfulName(b);
  return !!na && na === nb;
}

/** How two policy numbers relate:
 *  - "exact": identical
 *  - "renewal": same underlying policy across years — either one is the other plus a
 *     short trailing renewal suffix (HDFC appends 000/001/002…), OR they share a long
 *     stable prefix and differ only in the last 1–2 digits (HDFC ERGO changes the
 *     trailing digits each renewal). Care Health numbers don't change → caught by "exact".
 *  - "none": unrelated. */
export function numberMatchKind(a: string, b: string): "exact" | "renewal" | "none" {
  a = normNo(a); b = normNo(b);
  if (!a || !b) return "none";
  if (a === b) return "exact";
  const [long, short] = a.length >= b.length ? [a, b] : [b, a];
  // appended renewal suffix (e.g. base + "000")
  if (short.length >= 8 && long.length - short.length <= 4 && long.startsWith(short)) return "renewal";
  // trailing 1–2 digits changed year-over-year: long shared prefix, near-equal length
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const minLen = Math.min(a.length, b.length);
  if (minLen >= 10 && i >= minLen - 2 && Math.abs(a.length - b.length) <= 2) return "renewal";
  return "none";
}

/** True when two policy numbers refer to the same policy (exact or across a renewal). */
export function numbersMatch(a: string, b: string): boolean {
  return numberMatchKind(a, b) !== "none";
}

/** Match an extracted document to the holder it belongs to.
 *
 *  Identity model (agreed):
 *   • policy number  → the same policy (renewal) — strongest.
 *   • KYC / Client ID → the same person.
 *   • NAME decides the person. A phone NEVER merges two different names.
 *     - same name, phones don't conflict → same holder.
 *     - same name, but two DIFFERENT valid mobiles → NOT the same (split look-alikes).
 *   • Phone/member matches alone are ignored (they wrongly merged unrelated people).
 *  Returns null if nothing plausible. */
export function matchDocument(doc: ExtractedDoc, candidates: MatchCandidate[]): MatchResult | null {
  let best: MatchResult | null = null;
  const consider = (r: MatchResult) => { if (!best || r.confidence > best.confidence) best = r; };

  const docNo = doc.policyNumber ? normNo(doc.policyNumber) : null;
  const docClient = doc.insurerClientId ? doc.insurerClientId.toUpperCase() : null;
  const docName = meaningfulName(doc.customerName);
  const docPhone = validMobile(doc.mobile);

  for (const c of candidates) {
    // 1. policy number (strongest) — exact, or the same policy across a renewal
    if (docNo) {
      for (const p of c.policies) {
        let kind: "exact" | "renewal" | "none" = "none";
        for (const n of p.numbers) {
          const k = numberMatchKind(n, docNo);
          if (k === "exact") { kind = "exact"; break; }
          if (k === "renewal") kind = "renewal";
        }
        if (kind === "exact") consider({ holderId: c.holderId, policyId: p.policyId, versionId: p.versionId, confidence: 98, reason: "policy number match" });
        else if (kind === "renewal") consider({ holderId: c.holderId, policyId: p.policyId, versionId: p.versionId, confidence: 94, reason: "policy number match (renewed — trailing digits changed)" });
      }
    }
    // 2. insurer Client ID / Pehchaan — a per-person KYC identifier
    if (docClient && c.pehchaan && c.pehchaan.toUpperCase() === docClient) {
      consider({ holderId: c.holderId, policyId: c.policies[0]?.policyId ?? null, versionId: c.policies[0]?.versionId ?? null, confidence: 95, reason: "KYC / Client ID match" });
    }
    // 3. name — same person, UNLESS both sides have a real mobile and they differ
    if (docName && meaningfulName(c.name) === docName) {
      const cPhone = validMobile(c.mobile);
      const phonesConflict = !!(docPhone && cPhone && docPhone !== cPhone);
      if (!phonesConflict) {
        const confirmed = !!(docPhone && cPhone && docPhone === cPhone);
        consider({ holderId: c.holderId, policyId: c.policies[0]?.policyId ?? null, versionId: c.policies[0]?.versionId ?? null, confidence: confirmed ? 96 : 88, reason: confirmed ? "name + mobile match" : "name match" });
      }
      // phonesConflict ⇒ a different person who shares the name ⇒ do NOT match
    }
  }
  return best;
}
