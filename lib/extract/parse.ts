// Rule-based extraction from insurer PDF text (free, local, private).
// Tolerant regexes tuned to HDFC ERGO + Care Health; falls back gracefully.

export type ExtractedDoc = {
  docType: "policy_copy" | "renewal_notice" | "unknown";
  insurer: string | null;
  policyNumber: string | null;
  customerName: string | null;
  mobile: string | null; // may be masked (last 4)
  premium: number | null;
  sumInsured: number | null;
  dueDate: string | null; // iso
  startDate: string | null;
  endDate: string | null;
  productName: string | null;
  insurerClientId: string | null; // Care "Client ID" / HDFC Pehchaan
  firstInception: string | null; // original policy start (iso)
  tenureYears: number | null; // policy term length in years
  members: { name: string; relation: string | null; age: number | null; dob?: string | null }[];
  confidenceHint: number; // how many key fields were found (0-100)
};

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

function parseDate(s?: string | null): string | null {
  if (!s) return null;
  s = s.trim();
  let m = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,})[-/\s](\d{2,4})$/); // 24-Jul-2026
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mo !== undefined) {
      const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      const d = new Date(Date.UTC(y, mo, Number(m[1])));
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/); // 24/07/2026
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function num(s?: string | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[, ₹]/g, ""));
  return isNaN(n) ? null : n;
}
function first(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

// Words that follow a salutation but are NOT part of the name ("Dear X, Thank you…",
// "Dear X Welcome to…"). We stop the name before any of these.
const NAME_STOP = /^(thank|thanks|welcome|greetings|we|your|this|for|kindly|please|sir|madam|customer|it|as|the|to|on|is|are|has|have|regarding|congratulations|hope|warm)$/i;
// Salutations are never part of the actual name — drop them if captured.
const SALUTATION = /^(mr|mrs|ms|miss|dr|smt|shri|sri|m\/s)$/i;

/** Extract the customer name from a "Dear <name>," line, robustly — never crossing
 *  a line break, never swallowing filler words, and never returning a bare
 *  salutation like "Mr" (which would wrongly merge different people). */
function extractName(text: string): string | null {
  const m = text.match(/\bdear\s+(?:mr|mrs|ms|miss|dr|smt|shri)?\.?[ \t]*([A-Z][A-Za-z.'-]+(?:[ \t]+[A-Z][A-Za-z.'-]+){0,4})/i);
  if (!m) return null;
  const words: string[] = [];
  for (const w of m[1].trim().split(/[ \t]+/)) {
    const clean = w.replace(/[.,]/g, "");
    if (NAME_STOP.test(clean)) break; // stop at a filler word
    if (SALUTATION.test(clean)) continue; // skip a stray salutation, don't count it
    words.push(w.replace(/[.,]+$/, ""));
    if (words.length >= 4) break; // names are at most ~4 tokens
  }
  const name = words.join(" ").trim();
  return name.length >= 2 ? name : null; // salutation-only ⇒ empty ⇒ null
}

/** A real Indian mobile number, normalized to 10 digits — or null. Strips +91 /
 *  leading 0. Rejects agent codes, policy numbers, masked (Xxxx) and any number
 *  that isn't a genuine 10-digit mobile starting 6–9. */
export function validMobile(s: string | null | undefined): string | null {
  if (!s || /x/i.test(s)) return null; // masked → unusable
  let d = s.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export type AadhaarFields = { aadhaar: string | null; name: string | null; dob: string | null; gender: string | null; mobile: string | null; address: string | null };
export type PanFields = { pan: string | null; name: string | null; dob: string | null };

/** Extract Aadhaar fields from (OCR'd) text. Numbers/DOB/gender are reliable;
 *  name/address are best-effort and meant to be confirmed by the agent. */
export function parseAadhaar(text: string): AadhaarFields {
  const t = text.replace(/ /g, " ");
  const aadhaar = first(t, [/\b(\d{4}\s?\d{4}\s?\d{4})\b/])?.replace(/\s+/g, " ").trim() ?? null;
  const dobRaw = first(t, [/(?:DOB|Date of Birth|D\.O\.B)\s*[:.]?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i, /Year of Birth\s*[:.]?\s*(\d{4})/i, /\b(\d{2}[/-]\d{2}[/-]\d{4})\b/]);
  const dob = dobRaw && /^\d{4}$/.test(dobRaw) ? dobRaw : dobRaw ? parseDate(dobRaw)?.slice(0, 10) ?? dobRaw : null;
  const gender = first(t, [/\b(male|female|transgender)\b/i])?.toLowerCase() ?? null;
  const mobile = first(t, [/mobile\s*[:.]?\s*(\d{10})/i]);
  const name = first(t, [/\bTo\b[\s:]*\n?\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})/, /^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\s*$/m]);
  const address = first(t, [/(S\/O|D\/O|W\/O|C\/O)[\s\S]{0,200}?(?:PIN\s*Code\s*[:.]?\s*\d{6}|\b\d{6}\b)/i])?.replace(/\s+/g, " ").trim() ?? null;
  return { aadhaar: aadhaar && aadhaar.replace(/\D/g, "").length === 12 ? aadhaar : null, name, dob: dob ?? null, gender, mobile, address };
}

/** Extract PAN fields from (OCR'd) text. */
export function parsePan(text: string): PanFields {
  const pan = first(text, [/\b([A-Z]{5}\d{4}[A-Z])\b/]);
  const dob = parseDate(first(text, [/(?:DOB|Date of Birth)\s*[:.]?\s*(\d{2}[/-]\d{2}[/-]\d{4})/i, /\b(\d{2}[/-]\d{2}[/-]\d{4})\b/]))?.slice(0, 10) ?? null;
  const name = first(text, [/Name\s*[:.]?\s*\n?\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})/]);
  return { pan: pan ?? null, name: name ?? null, dob };
}

export function detectInsurer(text: string): string | null {
  if (/care\s*health|careinsurance|care supreme/i.test(text)) return "Care Health";
  if (/hdfc\s*ergo|hdfcergo|optima restore|my:?health/i.test(text)) return "HDFC ERGO";
  if (/star health/i.test(text)) return "Star Health";
  if (/niva\s*bupa|max bupa/i.test(text)) return "Niva Bupa";
  return null;
}

export function detectDocType(text: string): "policy_copy" | "renewal_notice" | "unknown" {
  // Strong renewal-notice signals (an actual reminder to pay) win first.
  if (/renewal notice|renewal intimation|renewal due date|due date\s*[:\-]|renew(?:ing)?[^.]{0,30}?before/i.test(text)) return "renewal_notice";
  // Strong policy-copy signals (an issued policy schedule / premium acknowledgement).
  if (/premium acknowledgement|policy schedule|certificate of insurance|policy period\s*[-:]?\s*start date|policy document|schedule of (?:the )?policy|nominee details/i.test(text)) return "policy_copy";
  // Weak renewal fallback (fine-print phrases that also appear in policy copies).
  if (/renew(?:ing)? your policy|renewal premium/i.test(text)) return "renewal_notice";
  return "unknown";
}

export function parseDocument(text: string): ExtractedDoc {
  const insurer = detectInsurer(text);
  const docType = detectDocType(text);

  const policyNumber = first(text, [
    /renew(?:ing)? your policy\s+(\d[\d/-]{5,})/i, // Care "renewing your policy 56237131"
    /policy\s*(?:number|no\.?)\s*[:\-]?\s*([0-9][A-Z0-9/-]{5,})/i,
    /\b(\d{17,19})\b/, // HDFC: 16-digit base + 3-digit renewal-cycle suffix (member IDs are 16 digits, so excluded)
    /(?:year|floater|individual|family|silver|gold)\b[^\n]{0,60}?(\d{14,19})/i,
  ]);
  // Renewal DUE date — insurer-specific renewal-notice labels first; for a
  // policy copy (no due-date label) fall back to the policy-period end date.
  const dueDate = parseDate(
    first(text, [
      /due date\s*[:\-]?\s*(\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4})/i, // HDFC "Due Date : 24-Jul-2026"
      /renew(?:ing)?[^.]{0,40}?before\s+(\d{1,2}[-/\s][A-Za-z0-9]{2,}[-/\s]\d{2,4})/i, // Care "before 24-Jul-2026"
      /renewal due date\s*[:\-]?\s*(\d{1,2}[-/][A-Za-z0-9]{2,}[-/]\d{2,4})/i,
      /policy period from[\s\S]{0,80}?to[^\n]{0,40}?on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i, // HDFC PA copy: period-end
      /period of insurance[\s\S]{0,60}?to\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i, // HDFC health copy: "To 03/07/2027"
      /policy period - end date[^\n]*?(\d{1,2}-[A-Za-z]{3}-\d{4})/i, // Care copy: "End Date … 18-Jun-2027"
    ])
  );
  const premium = num(
    first(text, [
      /inclusive of all taxes\)\s*[`₹]?\s*([\d,]+(?:\.\d+)?)/i, // HDFC
      /received an amount of\s*[`₹]?\s*([\d,]+(?:\.\d+)?)\s*towards premium/i, // HDFC copy "received an amount of ` 61901 towards premium"
      /total premium to be paid[^`₹\n]*[`₹]\s*([\d,]+(?:\.\d+)?)/i, // HDFC renewal "To Be Paid After Discount ` 83626"
      /premium amount\s*[`₹]\s*([\d,]+(?:\.\d+)?)/i, // HDFC renewal "Premium Amount ` 84730"
      /premium paid\s*rs\.?\s*([\d,]+(?:\.\d+)?)/i, // Care copy "Premium Paid Rs. 18,608.00"
      /([\d,]+\.\d{2})\s*\*?\s*figs are in indian rupees/i, // Care (number just before *Figs)
      /total annual premium\*?[\s\S]{0,90}?([\d,]+\.\d{2})/i, // Care renewal fallback
      /renewal premium\s*[:\-]?\s*[`₹]?\s*([\d,]+(?:\.\d+)?)/i,
      /gross premium\s*[`₹(]*\s*([\d,]+(?:\.\d+)?)/i, // HDFC PA "Gross Premium 4086"
      /net premium\s*[`₹(]*\s*([\d,]+(?:\.\d+)?)/i, // fallback
    ])
  );
  const sumInsured = num(
    first(text, [
      /(?:base\s+)?sum insured opted\s*[:\-]?\s*([\d,]+)/i, // HDFC "Base Sum Insured opted:1500000"
      /basic sum insured\s*[`₹]?\s*([\d,]+)/i, // HDFC
      /(?:base\s*)?sum insured[ \t]{0,3}([\d,]+\.\d{2})/i, // Care table (SI value adjacent)
      /\b\d{7,8}\s+[A-Z][A-Za-z .]{2,40}?\s+\d{1,3}\s+([\d,]+\.\d{2})/, // Care renewal row: polNo Name Age BASESI …
      /\d{2}[/-]\d{2}[/-]\d{4}\s+\d{1,3}\s+\w+\s+\d+\s+(\d{5,8})\s+\d{5,8}/, // HDFC renewal member row: DOB Age Rel Mult CurBaseSI SI
      /\bsum insured\s+(\d{6,8})\b/i, // Care copy "1 Sum Insured 1000000"
    ])
  );
  const insurerClientId = first(text, [/\b([A-Z]\d{6,8})\b/, /pehchaan kyc id\s*[:\-]?\s*([A-Z0-9]{8,})/i]);
  const productName = first(text, [
    /\b(optima secure|optima restore|care supreme|care classic|care freedom|health wallet|energy|my:?\s?health)\b/i, // known products
    /for\s+my:?\s*([A-Za-z][A-Za-z ]+?)\s*,\s*policy/i, // HDFC "for my: Optima Secure, Policy No"
    /your\s+(Individual [A-Za-z][A-Za-z ]+?)\s*\(/i, // HDFC "Your Individual Personal Accident ( Essential )"
    /(?:renewal of\s+)?your\s+([A-Za-z][A-Za-z \-]{3,40}?)\s+insurance policy\b/i, // HDFC "Your Health Wallet - Individual Insurance Policy"
    /policy schedule\s*[-–]\s*([A-Za-z][A-Za-z \-]{2,40}?)(?:\r|\n|UIN|$)/i, // "Policy Schedule - Health Wallet - Individual"
    /your\s+([A-Za-z][A-Za-z ]{3,28}?)\s+plan\b/i, // generic "your … Plan"
  ]);
  const mobile = first(text, [/(?:mobile|contact)\s*(?:no|number)?\s*[.:]*\s*([0-9Xx]{6,12})/i]);
  const customerName = extractName(text);
  const startDate = parseDate(first(text, [
    /policy\s*start\s*date\s*[:\-]?\s*(\d{1,2}[-/][A-Za-z0-9]{2,}[-/]\d{2,4})/i,
    /policy period from[^\n]{0,40}?on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i, // HDFC PA "From … on 02/07/2026"
    /period of insurance\s*:?\s*from\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i, // HDFC health "Period of Insurance : From 04/07/2026"
    /policy period - start date[^\n]*?(\d{1,2}-[A-Za-z]{3}-\d{4})/i, // Care "Start Date … 19-Jun-2026"
    /first policy inception date\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i,
  ]));
  const endDate = parseDate(first(text, [
    /policy\s*end\s*date\s*[:\-]?\s*(\d{1,2}[-/][A-Za-z0-9]{2,}[-/]\d{2,4})/i,
    /policy period from[\s\S]{0,80}?to[^\n]{0,40}?on\s+(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/i, // HDFC PA
    /period of insurance[\s\S]{0,60}?to\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i, // HDFC health
    /policy period - end date[^\n]*?(\d{1,2}-[A-Za-z]{3}-\d{4})/i, // Care
  ]));

  // Original inception (may be years before the current term) + policy tenure.
  const firstInception = parseDate(first(text, [
    /first policy inception date[^\d]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i, // capture after any non-digit chars
    /first policy inception date\s+(\d{1,2}-[A-Za-z]{3}-\d{4})/i,
    /(?:policy )?inception date\s*[:\-]?\s*(\d{1,2}[/-][A-Za-z0-9]{2,}[/-]\d{2,4})/i,
  ]));
  let tenureYears: number | null = null;
  if (startDate && endDate) {
    const yrs = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (365.25 * 86_400_000);
    if (yrs > 0.3) tenureYears = Math.max(1, Math.round(yrs));
  }

  // Insured members. Two formats: "Name (Relation)" and HDFC's insured-card row
  // "Name  <16-digit member id>  DD/MM/YYYY  M/F".
  const members: ExtractedDoc["members"] = [];
  const seen = new Set<string>();
  const add = (name: string, relation: string | null, dob: string | null) => {
    const key = name.toLowerCase().trim();
    if (!key || seen.has(key)) return;
    seen.add(key); members.push({ name: name.trim(), relation, age: null, dob });
  };
  for (const m of text.matchAll(/([A-Z][A-Za-z.\s]{2,40}?)\s*\((Self|Spouse|Wife|Husband|Son|Daughter|Father|Mother)\)/gi))
    add(m[1], m[2], null);
  for (const m of text.matchAll(/^([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){1,3})[ \t]+\d{16}[ \t]+(\d{2}[/-]\d{2}[/-]\d{4})[ \t]+[MF]\b/gm))
    add(m[1], null, parseDate(m[2])?.slice(0, 10) ?? null);

  const found = [policyNumber, premium, dueDate, sumInsured, productName].filter(Boolean).length;
  return {
    docType, insurer, policyNumber, customerName, mobile, premium, sumInsured,
    dueDate, startDate, endDate, productName, insurerClientId, firstInception, tenureYears, members,
    confidenceHint: Math.round((found / 5) * 100),
  };
}
