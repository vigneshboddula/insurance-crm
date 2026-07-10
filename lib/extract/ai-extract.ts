import "server-only";
import { aiAvailable, complete, extractJson, MODEL_FAST } from "@/lib/ai";

// AI-assisted extraction — reads an insurance policy copy / renewal notice and
// returns structured fields, for ANY insurer/format (no per-format rules needed).
// Runs only when the agent has configured their Anthropic key; the document text
// is scrubbed of Aadhaar/PAN by lib/ai's redactor before it leaves the machine.
// Used as a fallback/complement to the fast, free, fully-local rule parser.

export type AiFields = {
  insurer?: string | null;
  docType?: "policy_copy" | "renewal_notice" | null;
  policyNumber?: string | null;
  customerName?: string | null;
  productName?: string | null;
  premium?: number | null;
  sumInsured?: number | null;
  startDate?: string | null;
  firstInception?: string | null;
  endDate?: string | null;
  dueDate?: string | null;
  tenureYears?: number | null;
  deductible?: number | null;
  members?: { name: string; relation?: string | null; dob?: string | null }[] | null;
};

const SYSTEM =
  "You extract structured data from Indian insurance documents (policy copies and renewal notices from insurers like HDFC ERGO, Care Health, Star Health, Niva Bupa, ICICI Lombard, ICICI Prudential, LIC, Bajaj Allianz, Tata AIG, SBI Life, Max Life, etc.). " +
  "Read carefully and return ONLY one JSON object — no prose. Use null for anything genuinely absent. " +
  "Dates must be YYYY-MM-DD. Amounts must be plain integers (no commas, no ₹, no decimals unless meaningful).";

const PROMPT_TAIL =
  '\n\nReturn exactly this JSON shape:\n' +
  '{"insurer":string,"docType":"policy_copy"|"renewal_notice","policyNumber":string,"customerName":string,' +
  '"productName":string,"premium":number,"sumInsured":number,"startDate":"YYYY-MM-DD","firstInception":"YYYY-MM-DD",' +
  '"endDate":"YYYY-MM-DD","dueDate":"YYYY-MM-DD","tenureYears":number,"deductible":number,' +
  '"members":[{"name":string,"relation":string,"dob":"YYYY-MM-DD"}]}\n' +
  "Field guidance:\n" +
  "- premium = the TOTAL premium payable (after discount, including taxes/GST) — the amount the customer actually pays.\n" +
  "- sumInsured = the base sum insured (the cover amount), not any bonus.\n" +
  "- startDate = the CURRENT policy period start; endDate = the current period end; dueDate = the renewal due date (usually the day the current term ends / the reminder's due date).\n" +
  "- firstInception = the ORIGINAL 'first policy inception date' (often years before the current term). If not stated, use the current start date.\n" +
  "- tenureYears = policy term length in years (usually 1).\n" +
  "- deductible = policy deductible/aggregate deductible in rupees; use 0 if there is none.\n" +
  "- customerName = the policyholder's name only (never include words like 'Thank you' or 'Welcome').\n" +
  "- members = every insured person with their relation to the policyholder (Self/Spouse/Son/Daughter/Father/Mother) and date of birth if shown.";

/** Extract fields via Claude. Returns null when AI is off, the text is empty, or the call fails. */
export async function aiExtractDocument(text: string): Promise<AiFields | null> {
  if (!aiAvailable()) return null;
  const t = text.trim();
  if (t.length < 40) return null;
  try {
    const out = await complete({
      model: MODEL_FAST,
      system: SYSTEM,
      prompt: `Document text:\n"""${t.slice(0, 18000)}"""${PROMPT_TAIL}`,
      maxTokens: 1000,
    });
    return extractJson<AiFields>(out);
  } catch {
    return null;
  }
}
