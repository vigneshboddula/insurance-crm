"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { saveEncryptedFile } from "@/lib/storage";
import { extractPdfText } from "@/lib/extract/pdf";
import { extractDoc } from "@/lib/extract/smart";
import { matchDocument, numbersMatch, type MatchCandidate } from "@/lib/extract/match";
import { validMobile } from "@/lib/extract/parse";
import { loadCandidates, attach } from "@/lib/ingest-core";
import { createPolicyFromExtract } from "@/lib/policy-fill";

// ──────────────────────────────────────────────────────────────
// Bulk PDF intake for the Policies and Renewals pages. No review queue —
// each PDF is read and acted on immediately, with a clear per-file outcome so a
// large run (up to ~1000 files) is fully auditable.
//   • Policies page  → bulkUploadPolicies: creates NEW policies. A policy whose
//     number already exists is SKIPPED and reported as a duplicate (never
//     overwritten). Duplicates are identified by policy number (globally unique).
//   • Renewals page  → bulkUploadRenewals: attaches a renewal notice to an
//     EXISTING policy (updates renewal date + premium + attaches the PDF). A
//     notice whose policy isn't in the system is reported as "no match".
// ──────────────────────────────────────────────────────────────

export type BulkOutcome = {
  file: string;
  status: "created" | "updated" | "duplicate" | "no_match" | "unreadable";
  policyNumber?: string;
  holder?: string;
  newHolder?: boolean;
  insurer?: string; // for classification breakdown (HDFC ERGO / Care / Niva Bupa / …)
  matchedExisting?: string; // for duplicates: the existing policy number it collides with
};

export type BulkResult = { total: number; outcomes: BulkOutcome[] };

// Holder match confidence at/above which we reuse an existing holder rather than
// creating a new one (name match = 80; mobile/KYC are higher). Below this we
// treat the person as new.
const HOLDER_MATCH_MIN = 80;

/** Find an existing policy whose number matches (exact or renewal-tolerant). */
function findExistingPolicy(
  policyNumber: string,
  existing: { id: string; policyNumber: string }[],
): { id: string; policyNumber: string } | null {
  return existing.find((p) => numbersMatch(p.policyNumber, policyNumber)) ?? null;
}

async function readFiles(fd: FormData): Promise<{ name: string; buf: Buffer }[]> {
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const out: { name: string; buf: Buffer }[] = [];
  for (const f of files) out.push({ name: f.name, buf: Buffer.from(await f.arrayBuffer()) });
  return out;
}

type ExDoc = Awaited<ReturnType<typeof extractDoc>>;

/** Match the document to an existing holder, or create a brand-new one. */
async function resolveHolder(ex: ExDoc, candidates: MatchCandidate[], fileName: string):
  Promise<{ holderId: string; holderName: string; newHolder: boolean; candidates: MatchCandidate[] }> {
  const match = matchDocument(ex, candidates);
  if (match && match.confidence >= HOLDER_MATCH_MIN) {
    return { holderId: match.holderId, holderName: candidates.find((c) => c.holderId === match.holderId)?.name ?? ex.customerName ?? "", newHolder: false, candidates };
  }
  const name = (ex.customerName ?? fileName.replace(/\.[^.]+$/, "")).trim() || "Unknown";
  const holder = await prisma.client.create({
    data: { name, phone: validMobile(ex.mobile) ?? "", vault: { create: { insurerClientId: ex.insurerClientId ?? undefined } } },
  });
  return { holderId: holder.id, holderName: name, newHolder: true, candidates: await loadCandidates() };
}

/** Policies page — bulk-add NEW policies from policy-copy PDFs. */
export async function bulkUploadPolicies(fd: FormData): Promise<BulkResult> {
  const files = await readFiles(fd);
  const outcomes: BulkOutcome[] = [];

  // one snapshot of state for the whole batch; we append as we create
  const existing = await prisma.policy.findMany({ select: { id: true, policyNumber: true } });
  let candidates: MatchCandidate[] = await loadCandidates();

  for (const f of files) {
    try {
      const text = await extractPdfText(f.buf);
      const ex = await extractDoc(text);
      if (!ex.policyNumber) { outcomes.push({ file: f.name, status: "unreadable" }); continue; }

      const dup = findExistingPolicy(ex.policyNumber, existing);
      if (dup) { outcomes.push({ file: f.name, status: "duplicate", policyNumber: ex.policyNumber, insurer: ex.insurer ?? undefined, matchedExisting: dup.policyNumber }); continue; }

      const r = await resolveHolder(ex, candidates, f.name);
      candidates = r.candidates;

      const created = await createPolicyFromExtract(r.holderId, ex, "policy_copy");
      if (!created) { outcomes.push({ file: f.name, status: "duplicate", policyNumber: ex.policyNumber, insurer: ex.insurer ?? undefined }); continue; }

      const storagePath = await saveEncryptedFile(f.buf);
      await attach({ holderId: r.holderId, policyId: created.policyId, versionId: created.versionId, docType: "policy_copy", ex, fileName: f.name, mimeType: "application/pdf", sizeBytes: f.buf.length, storagePath });

      existing.push({ id: created.policyId, policyNumber: ex.policyNumber });
      outcomes.push({ file: f.name, status: "created", policyNumber: ex.policyNumber, holder: r.holderName, newHolder: r.newHolder, insurer: ex.insurer ?? undefined });
    } catch {
      outcomes.push({ file: f.name, status: "unreadable" });
    }
  }

  revalidatePath("/policies");
  revalidatePath("/clients");
  return { total: files.length, outcomes };
}

/** Renewals page — attach renewal-notice PDFs. Classifies by insurer. If the
 *  policy already exists → attach the notice + roll the renewal. If NOT → create
 *  the holder + policy from the notice (a renewal notice ≈ a certain renewal, so
 *  we don't want to lose it) and flag it as newly created. */
export async function bulkUploadRenewals(fd: FormData): Promise<BulkResult> {
  const files = await readFiles(fd);
  const outcomes: BulkOutcome[] = [];

  const existing = await prisma.policy.findMany({ select: { id: true, policyNumber: true, clientId: true, versions: { select: { id: true, policyNumber: true } } } });
  let candidates: MatchCandidate[] = await loadCandidates();

  for (const f of files) {
    try {
      const text = await extractPdfText(f.buf);
      const ex = await extractDoc(text);
      const insurer = ex.insurer ?? undefined;
      if (!ex.policyNumber) { outcomes.push({ file: f.name, status: "unreadable", insurer }); continue; }

      const pol = existing.find((p) => numbersMatch(p.policyNumber, ex.policyNumber!) || p.versions.some((v) => numbersMatch(v.policyNumber, ex.policyNumber!)));

      if (pol) {
        const ver = pol.versions.find((v) => numbersMatch(v.policyNumber, ex.policyNumber!)) ?? pol.versions[0] ?? null;
        const storagePath = await saveEncryptedFile(f.buf);
        await attach({ holderId: pol.clientId, policyId: pol.id, versionId: ver?.id ?? null, docType: "renewal_notice", ex, fileName: f.name, mimeType: "application/pdf", sizeBytes: f.buf.length, storagePath });
        outcomes.push({ file: f.name, status: "updated", policyNumber: ex.policyNumber, insurer });
        continue;
      }

      // Policy not in the system — create the holder + policy from the notice.
      const r = await resolveHolder(ex, candidates, f.name);
      candidates = r.candidates;
      const created = await createPolicyFromExtract(r.holderId, ex, "renewal_notice");
      if (!created) { outcomes.push({ file: f.name, status: "duplicate", policyNumber: ex.policyNumber, insurer }); continue; }
      const storagePath = await saveEncryptedFile(f.buf);
      await attach({ holderId: r.holderId, policyId: created.policyId, versionId: created.versionId, docType: "renewal_notice", ex, fileName: f.name, mimeType: "application/pdf", sizeBytes: f.buf.length, storagePath });
      existing.push({ id: created.policyId, policyNumber: ex.policyNumber, clientId: r.holderId, versions: created.versionId ? [{ id: created.versionId, policyNumber: ex.policyNumber }] : [] });
      outcomes.push({ file: f.name, status: "created", policyNumber: ex.policyNumber, holder: r.holderName, newHolder: r.newHolder, insurer });
    } catch {
      outcomes.push({ file: f.name, status: "unreadable" });
    }
  }

  revalidatePath("/renewals");
  revalidatePath("/clients");
  return { total: files.length, outcomes };
}
