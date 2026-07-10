import "server-only";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import type { ExtractedDoc } from "@/lib/extract/parse";
import { sameName } from "@/lib/extract/match";

// ──────────────────────────────────────────────────────────────
// ONE shared "document → policy record" writer, used by every path that
// scans a policy PDF (profile Upload & Scan, bulk /import, watched folder).
// Fixes the 10-day pain: previously each path wrote a different subset of
// fields (and the profile scan could never CREATE a policy at all), so
// results depended on which door a PDF happened to enter through.
// Rules: extracted values fill any EMPTY field (never overwrite agent input);
// members are added when the policy has none; create builds the full record.
// ──────────────────────────────────────────────────────────────

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export type FillLabel = { label: string; value: string };

/** Guess the line of business from the extracted product/text. */
export function lineFromExtract(ex: ExtractedDoc): string {
  const p = (ex.productName ?? "").toLowerCase();
  if (/personal accident/.test(p)) return "personal_accident";
  if (/motor|two wheeler|car /.test(p)) return "motor";
  if (/term/.test(p)) return "term";
  return "health";
}

/** Individual vs family floater — from the product name, else the member count. */
export function detectPolicyType(ex: ExtractedDoc): "individual" | "floater" {
  const p = (ex.productName ?? "").toLowerCase();
  if (/floater|family/.test(p)) return "floater";
  if (/individual/.test(p)) return "individual";
  return ex.members.length > 1 ? "floater" : "individual";
}

/** Fill the holder's own personal details (DOB) from their "Self" insured
 *  member when those fields are still blank — so the profile self-populates. */
async function autofillHolder(clientId: string, ex: ExtractedDoc): Promise<void> {
  const holder = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true, dob: true } });
  if (!holder) return;
  const isSelf = (m: ExtractedDoc["members"][number]) =>
    (m.relation ?? "").toLowerCase() === "self" || m.name.trim().toLowerCase() === holder.name.trim().toLowerCase();
  const self = ex.members.find(isSelf);
  const data: Record<string, unknown> = {};
  if (!holder.dob && self?.dob) data.dob = new Date(self.dob);
  if (Object.keys(data).length) await prisma.client.update({ where: { id: clientId }, data });
}

/** Add insured members to a policy that has none. Extracted members win; the
 *  holder is always ensured as Self (correct for individual policies). */
async function ensureMembers(policyId: string, clientId: string, ex: ExtractedDoc): Promise<number> {
  const count = await prisma.policyInsured.count({ where: { policyId } });
  if (count > 0) return 0;
  const holder = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true, dob: true } });
  let toAdd = ex.members.map((m) => ({ name: m.name, relation: m.relation, dob: m.dob ? new Date(m.dob) : null }));
  // Compare names ignoring titles/spacing so "Kadam Siddeshwar" and "Mr Kadam
  // Siddeshwar" aren't both added as separate "Self" members.
  const isHolder = (n: string) => !!holder && sameName(n, holder.name);
  if (!toAdd.length || !toAdd.some((m) => isHolder(m.name))) {
    toAdd = [{ name: holder?.name ?? ex.customerName ?? "Insured", relation: "Self", dob: holder?.dob ?? null }, ...toAdd.filter((m) => !isHolder(m.name))];
  }
  for (const m of toAdd) {
    await prisma.policyInsured.create({ data: { policyId, name: m.name, relation: m.relation, dob: m.dob, clientId: isHolder(m.name) ? clientId : null } });
  }
  return toAdd.length;
}

/**
 * Fill an EXISTING policy from an extracted document. `isNotice` steers which
 * date becomes the renewal date. Returns human-readable labels of what changed.
 */
export async function applyExtractToPolicy(policyId: string, ex: ExtractedDoc, isNotice: boolean): Promise<FillLabel[]> {
  const pol = await prisma.policy.findUnique({ where: { id: policyId } });
  if (!pol) return [];
  const updated: FillLabel[] = [];
  const data: Record<string, unknown> = {};
  const newer = !!ex.startDate && (!pol.startDate || new Date(ex.startDate) > pol.startDate);

  if (isNotice) {
    if (ex.dueDate) { data.renewalDate = new Date(ex.dueDate); updated.push({ label: "Renewal due date", value: fmtDate(ex.dueDate) }); }
  } else {
    if (ex.startDate && newer) { data.startDate = new Date(ex.startDate); updated.push({ label: "Start date", value: fmtDate(ex.startDate) }); }
    const ren = ex.endDate ?? ex.dueDate;
    if (ren) { data.renewalDate = new Date(ren); updated.push({ label: "Renewal date", value: fmtDate(ren) }); }
  }

  if (ex.premium) { data.premium = ex.premium; updated.push({ label: isNotice ? "Renewal premium" : "Premium", value: inr(ex.premium) }); }
  if (ex.sumInsured) { data.sumAssured = ex.sumInsured; updated.push({ label: "Sum insured", value: inr(ex.sumInsured) }); }
  if (ex.productName && !pol.variant) { data.planName = ex.productName; data.variant = ex.productName; }
  if (!pol.policyType) { const t = detectPolicyType(ex); data.policyType = t; updated.push({ label: "Policy type", value: t === "floater" ? "Family floater" : "Individual" }); }
  const inception = ex.firstInception ?? ex.startDate;
  if (!pol.firstInception && inception) { data.firstInception = new Date(inception); updated.push({ label: "First policy inception date", value: fmtDate(inception) }); }
  if (!pol.tenureYears) { const t = ex.tenureYears ?? 1; data.tenureYears = t; updated.push({ label: "Tenure", value: `${t} yr` }); }
  if (pol.deductible === null || pol.deductible === undefined) { data.deductible = 0; updated.push({ label: "Deductible", value: "₹0 (confirm)" }); }
  if (Object.keys(data).length) await prisma.policy.update({ where: { id: policyId }, data });

  const added = await ensureMembers(policyId, pol.clientId, ex);
  if (added) updated.push({ label: "Insured members", value: `${added} added` });
  await autofillHolder(pol.clientId, ex);

  if (!isNotice && newer) {
    await prisma.renewal.updateMany({ where: { policyId, status: { in: ["pending", "reminded"] } }, data: { status: "renewed", renewedAt: new Date() } });
    updated.push({ label: "Renewal status", value: "Completed" });
  }
  return updated;
}

/**
 * CREATE a policy (+ version + members) on a holder from an extracted document.
 * Used when a scan finds no matching policy — previously the data was dropped.
 * Returns null if the policy number already exists elsewhere (never duplicate).
 */
export async function createPolicyFromExtract(clientId: string, ex: ExtractedDoc, docType: string):
  Promise<{ policyId: string; versionId: string | null; labels: FillLabel[] } | null> {
  if (!ex.policyNumber) return null;
  const clash = await prisma.policy.findUnique({ where: { policyNumber: ex.policyNumber } });
  if (clash) return null; // exists (possibly on another holder) — caller shows a note

  const start = ex.startDate ? new Date(ex.startDate) : new Date();
  const renewal = ex.endDate ?? ex.dueDate;
  const renewalDate = renewal ? new Date(renewal) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  const inception = ex.firstInception ?? ex.startDate;

  const pol = await prisma.policy.create({
    data: {
      clientId,
      line: lineFromExtract(ex),
      carrier: ex.insurer ?? "",
      policyNumber: ex.policyNumber,
      planName: ex.productName ?? undefined,
      variant: ex.productName ?? undefined,
      sumAssured: ex.sumInsured ?? 0,
      premium: ex.premium ?? 0,
      policyType: detectPolicyType(ex),
      deductible: 0,
      tenureYears: ex.tenureYears ?? 1,
      firstInception: inception ? new Date(inception) : undefined,
      startDate: start,
      renewalDate,
      status: "active",
      source: "scan",
      versions: {
        create: {
          policyNumber: ex.policyNumber,
          premium: ex.premium ?? undefined,
          sumInsured: ex.sumInsured ?? undefined,
          startDate: ex.startDate ? new Date(ex.startDate) : undefined,
          endDate: ex.endDate ? new Date(ex.endDate) : undefined,
          dueDate: renewalDate,
          source: docType === "renewal_notice" ? "renewal_notice" : "policy_copy",
        },
      },
    },
    include: { versions: true },
  });
  await ensureMembers(pol.id, clientId, ex);
  await autofillHolder(clientId, ex);

  const labels: FillLabel[] = [{ label: "Policy created", value: `${pol.carrier || "—"} · ${pol.policyNumber}` }];
  if (ex.premium) labels.push({ label: "Premium", value: inr(ex.premium) });
  if (ex.sumInsured) labels.push({ label: "Sum insured", value: inr(ex.sumInsured) });
  labels.push({ label: "Renewal date", value: fmtDate(renewalDate) });
  return { policyId: pol.id, versionId: pol.versions[0]?.id ?? null, labels };
}
