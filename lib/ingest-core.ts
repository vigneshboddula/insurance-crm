import "server-only";
import { prisma } from "@/lib/db";
import { saveEncryptedFile } from "@/lib/storage";
import { extractPdfText } from "@/lib/extract/pdf";
import { type ExtractedDoc } from "@/lib/extract/parse";
import { extractDoc } from "@/lib/extract/smart";
import { applyExtractToPolicy } from "@/lib/policy-fill";
import { decide } from "@/lib/extract/ingest";
import type { MatchCandidate } from "@/lib/extract/match";

// Shared bulk-ingest primitives, used by both the manual /import flow
// (app/import/ingest-actions.ts) and the Phase-3 auto-intake (lib/intake.ts —
// watched folder + IMAP). Keeping them here means one code path decides matches,
// attaches documents, and updates policy versions.

export async function loadCandidates(): Promise<MatchCandidate[]> {
  const holders = await prisma.client.findMany({
    where: { archivedAt: null, deletedAt: null },
    include: {
      vault: { select: { pehchaanKycId: true, insurerClientId: true, whatsappNumber: true } },
      policies: { include: { versions: { select: { id: true, policyNumber: true, previousPolicyNumber: true } }, insuredMembers: { select: { name: true } } } },
    },
  });
  return holders.map((h) => ({
    holderId: h.id,
    name: h.name,
    mobile: h.phone || h.vault?.whatsappNumber || null,
    pehchaan: h.vault?.pehchaanKycId || h.vault?.insurerClientId || null,
    members: h.policies.flatMap((p) => p.insuredMembers.map((m) => m.name)),
    policies: h.policies.flatMap((p) => {
      const base = { policyId: p.id, numbers: [p.policyNumber, p.previousPolicyNumber].filter(Boolean) as string[] };
      const perVersion = p.versions.map((v) => ({ policyId: p.id, versionId: v.id, numbers: [v.policyNumber, v.previousPolicyNumber].filter(Boolean) as string[] }));
      return perVersion.length ? perVersion : [{ ...base, versionId: null as string | null }];
    }),
  }));
}

export async function remember(key: string, clientId: string) {
  await prisma.importMatch.upsert({ where: { key }, update: { clientId }, create: { key, clientId } });
}

/** Create the Document, link it to the holder/version's correct bucket, and
 *  update the version (premium/due for notices). Shared by auto-attach + review. */
export async function attach(opts: {
  holderId: string; policyId: string | null; versionId: string | null;
  docType: string; ex: ExtractedDoc; fileName: string; mimeType: string; sizeBytes: number; storagePath: string;
}) {
  const { holderId, policyId, versionId, docType, ex } = opts;
  let doc = await prisma.document.findFirst({ where: { clientId: holderId, fileName: opts.fileName, sizeBytes: opts.sizeBytes } });
  if (!doc) {
    doc = await prisma.document.create({
      data: {
        clientId: holderId, type: docType, label: ex.productName ?? undefined,
        fileName: opts.fileName, mimeType: opts.mimeType, sizeBytes: opts.sizeBytes, storagePath: opts.storagePath,
        policyId: policyId ?? undefined, policyVersionId: versionId ?? undefined,
      },
    });
  }
  if (versionId) {
    if (docType === "renewal_notice") {
      await prisma.policyVersion.update({
        where: { id: versionId },
        data: { renewalNoticeDocId: doc.id, dueDate: ex.dueDate ? new Date(ex.dueDate) : undefined, premium: ex.premium ?? undefined },
      });
    } else {
      await prisma.policyVersion.update({ where: { id: versionId }, data: { policyCopyDocId: doc.id } });
    }
  }
  // Same full field-fill as the profile Upload & Scan — one behaviour everywhere.
  if (policyId) await applyExtractToPolicy(policyId, ex, docType === "renewal_notice");
  if (ex.policyNumber) await remember("pol:" + ex.policyNumber, holderId);
  return doc.id;
}

export type IngestResult = "attached" | "review" | "unmatched" | "error";

/** Ingest one PDF's bytes: store encrypted → extract → match → auto-attach or
 *  queue in the review queue. Returns the outcome. Never throws. */
export async function ingestOne(fileName: string, buf: Buffer, kind: string, candidates?: MatchCandidate[]): Promise<IngestResult> {
  try {
    const cands = candidates ?? (await loadCandidates());
    const storagePath = await saveEncryptedFile(buf);
    const text = await extractPdfText(buf);
    const ex = await extractDoc(text);
    const docType = kind !== "auto" ? kind : ex.docType !== "unknown" ? ex.docType : "policy_copy";
    const d = decide(ex, cands);

    const ingest = await prisma.ingestDoc.create({
      data: {
        fileName, mimeType: "application/pdf", sizeBytes: buf.length, storagePath,
        detectedType: docType, insurer: ex.insurer ?? undefined, extracted: JSON.stringify(ex),
        matchedHolderId: d.match?.holderId ?? undefined, matchedPolicyId: d.match?.policyId ?? undefined,
        matchedVersionId: d.match?.versionId ?? undefined, matchConfidence: d.match?.confidence ?? 0,
        status: d.status, note: d.match?.reason,
      },
    });

    if (d.status === "attached" && d.match) {
      await attach({ holderId: d.match.holderId, policyId: d.match.policyId, versionId: d.match.versionId, docType, ex, fileName, mimeType: "application/pdf", sizeBytes: buf.length, storagePath });
      await prisma.ingestDoc.update({ where: { id: ingest.id }, data: { status: "attached" } });
      return "attached";
    }
    return d.status === "review" ? "review" : "unmatched";
  } catch {
    return "error";
  }
}
