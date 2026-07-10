"use server";

import { extractPdfText } from "@/lib/extract/pdf";
import { extractDoc } from "@/lib/extract/smart";

// Item 23 — autofill the Add-Policy form from a policy PDF / renewal notice.
// Reads the uploaded PDF locally (free, private), extracts fields, and returns a
// draft the form prefills. Nothing is stored; the agent reviews before saving.

export type PolicyDraft = {
  carrier?: string; line?: string; planName?: string; variant?: string;
  policyNumber?: string; sumAssured?: number; premium?: number;
  startDate?: string; renewalDate?: string; firstInception?: string;
  insuredMembersText?: string;
  found: string[]; // which fields were extracted (for the "review these" hint)
};

const HEALTH_HINT = /(health|mediclaim|optima|care|arogya|hospit|floater)/i;

export async function extractPolicyDraft(fd: FormData): Promise<{ ok: boolean; error?: string; draft?: PolicyDraft }> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file" };
  if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) return { ok: false, error: "Please upload a PDF." };
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const text = await extractPdfText(buf);
    const ex = await extractDoc(text);
    const found: string[] = [];
    const draft: PolicyDraft = { found };
    if (ex.insurer) { draft.carrier = ex.insurer; found.push("carrier"); }
    if (ex.productName) { draft.planName = ex.productName; draft.variant = ex.productName; found.push("plan"); }
    if (ex.policyNumber) { draft.policyNumber = ex.policyNumber; found.push("policyNumber"); }
    if (ex.sumInsured != null) { draft.sumAssured = ex.sumInsured; found.push("sumAssured"); }
    if (ex.premium != null) { draft.premium = ex.premium; found.push("premium"); }
    if (ex.startDate) { draft.startDate = ex.startDate.slice(0, 10); draft.firstInception = ex.startDate.slice(0, 10); found.push("startDate"); }
    if (ex.dueDate) { draft.renewalDate = ex.dueDate.slice(0, 10); found.push("renewalDate"); }
    if ((ex.productName && HEALTH_HINT.test(ex.productName)) || HEALTH_HINT.test(text.slice(0, 4000))) { draft.line = "health"; found.push("line"); }
    if (ex.members?.length) {
      draft.insuredMembersText = ex.members.map((m) => `${m.name}${m.relation ? ` (${m.relation})` : ""}`).join("\n");
      found.push("members");
    }
    if (!found.length) return { ok: false, error: "Couldn't read fields from this PDF — enter them manually.", draft };
    return { ok: true, draft };
  } catch {
    return { ok: false, error: "Couldn't read this PDF — it may be a scan without a text layer." };
  }
}
