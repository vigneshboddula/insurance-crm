"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { saveEncryptedFile, deleteStoredFile } from "@/lib/storage";
import { extractPdfText } from "@/lib/extract/pdf";
import { extractDoc } from "@/lib/extract/smart";
import { applyExtractToPolicy, createPolicyFromExtract } from "@/lib/policy-fill";
import { numbersMatch } from "@/lib/extract/match";
import { fmtDate } from "@/lib/format";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}
function dateVal(fd: FormData, key: string): Date | undefined {
  const s = str(fd, key);
  return s ? new Date(s) : undefined;
}
function numVal(fd: FormData, key: string): number | undefined {
  const s = str(fd, key);
  if (s === undefined) return undefined;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export async function createClient(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new Error("Name is required");
  // Everything else may be blank — the record saves and is flagged "Needs review".
  const phone = str(fd, "phone") ?? "";

  // household: pick existing, or create from a typed name
  let householdId = str(fd, "householdId");
  const newHousehold = str(fd, "newHousehold");
  if (!householdId && newHousehold) {
    const h = await prisma.household.create({ data: { name: newHousehold, address: str(fd, "address") } });
    householdId = h.id;
  }

  const sameAsPhone = fd.get("waSameAsPhone") === "on";
  const whatsappNumber = sameAsPhone ? phone : str(fd, "whatsappNumber") ?? phone;

  const client = await prisma.client.create({
    data: {
      name,
      phone,
      altPhone: str(fd, "altPhone"),
      email: str(fd, "email"),
      address: str(fd, "address"),
      dob: dateVal(fd, "dob"),
      occupation: str(fd, "occupation"),
      incomeBand: str(fd, "incomeBand"),
      gender: str(fd, "gender"),
      relationship: str(fd, "relationship"),
      tags: str(fd, "tags"),
      notes: str(fd, "notes"),
      instagram: str(fd, "instagram"),
      linkedin: str(fd, "linkedin"),
      facebook: str(fd, "facebook"),
      householdId,
      vault: {
        create: {
          aadhaarEnc: encrypt(str(fd, "aadhaar")),
          panEnc: encrypt(str(fd, "pan")),
          whatsappNumber,
          postalAddress: str(fd, "address"),
          dob: dateVal(fd, "dob"),
          nomineeName: str(fd, "nomineeName"),
          nomineeRelation: str(fd, "nomineeRelation"),
          pehchaanKycId: str(fd, "pehchaanKycId"),
          insurerClientId: str(fd, "insurerClientId"),
        },
      },
    },
  });
  revalidatePath("/clients");
  // continue the flow: land on the new profile with the Add-Policy step open
  redirect(`/clients/${client.id}?welcome=1`);
}

export async function updateVault(fd: FormData) {
  const clientId = str(fd, "clientId");
  if (!clientId) throw new Error("Missing client");
  const aadhaar = str(fd, "aadhaar");
  const pan = str(fd, "pan");

  const data: Record<string, unknown> = {
    whatsappNumber: str(fd, "whatsappNumber"),
    postalAddress: str(fd, "postalAddress"),
    dob: dateVal(fd, "dob"),
    nomineeName: str(fd, "nomineeName"),
    nomineeRelation: str(fd, "nomineeRelation"),
    pehchaanKycId: str(fd, "pehchaanKycId"),
    insurerClientId: str(fd, "insurerClientId"),
  };
  // only overwrite encrypted IDs when a new value is actually entered
  if (aadhaar) data.aadhaarEnc = encrypt(aadhaar);
  if (pan) data.panEnc = encrypt(pan);

  await prisma.clientVault.upsert({
    where: { clientId },
    update: data,
    create: { clientId, ...data },
  });
  revalidatePath(`/clients/${clientId}`);
}

/** Decrypt a single ID field — called on explicit "reveal" click only. */
export async function revealVaultField(clientId: string, field: "aadhaar" | "pan"): Promise<string | null> {
  const vault = await prisma.clientVault.findUnique({ where: { clientId } });
  if (!vault) return null;
  // audit trail: record THAT a reveal happened, never the value
  await prisma.auditLog.create({ data: { event: "vault_reveal", detail: field, clientId } });
  return decrypt(field === "aadhaar" ? vault.aadhaarEnc : vault.panEnc);
}

export async function uploadDocument(fd: FormData) {
  const clientId = str(fd, "clientId");
  const type = str(fd, "type") ?? "other";
  const file = fd.get("file");
  if (!clientId || !(file instanceof File) || file.size === 0) throw new Error("Choose a file");

  const bytes = Buffer.from(await file.arrayBuffer());
  const storagePath = await saveEncryptedFile(bytes);
  await prisma.document.create({
    data: {
      clientId,
      type,
      label: str(fd, "label"),
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      storagePath,
      policyId: str(fd, "policyId"),
    },
  });
  revalidatePath(`/clients/${clientId}`);
}

export type ScanResult = {
  fileName: string; docType: string; duplicate: boolean;
  updated: { label: string; value: string }[]; matched: boolean; note?: string;
};

/** Upload a document, scan it, auto-update the holder's record, then store it. */
export async function uploadAndScan(fd: FormData): Promise<ScanResult> {
  const clientId = str(fd, "clientId");
  const chosenType = str(fd, "type") ?? "other";
  const file = fd.get("file");
  if (!clientId || !(file instanceof File) || file.size === 0) throw new Error("Choose a file");

  // Same file already on this holder? We still re-scan (to fill any missing
  // fields) but won't store a duplicate copy.
  const dup = await prisma.document.findFirst({ where: { clientId, fileName: file.name, sizeBytes: file.size } });

  const bytes = Buffer.from(await file.arrayBuffer());
  const isPdf = (file.type || "").includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
  const text = isPdf ? await extractPdfText(bytes) : "";
  const ex = await extractDoc(text);

  const docType = chosenType === "policy_copy" || chosenType === "renewal_notice" ? chosenType : ex.docType !== "unknown" ? ex.docType : chosenType;
  const updated: { label: string; value: string }[] = [];
  let note: string | undefined;
  let policyId: string | null = null;
  let versionId: string | null = null;

  if ((docType === "policy_copy" || docType === "renewal_notice") && ex.policyNumber) {
    const policies = await prisma.policy.findMany({ where: { clientId }, include: { versions: true, insuredMembers: true } });
    const pol = policies.find(
      (p) =>
        numbersMatch(p.policyNumber, ex.policyNumber!) ||
        (p.previousPolicyNumber && numbersMatch(p.previousPolicyNumber, ex.policyNumber!)) ||
        p.versions.some((v) => numbersMatch(v.policyNumber, ex.policyNumber!))
    );
    if (pol) {
      policyId = pol.id;
      const ver = pol.versions.find((v) => numbersMatch(v.policyNumber, ex.policyNumber!)) ?? pol.versions[0] ?? null;
      versionId = ver?.id ?? null;

      if (docType === "renewal_notice" && ver) {
        await prisma.policyVersion.update({ where: { id: ver.id }, data: { dueDate: ex.dueDate ? new Date(ex.dueDate) : undefined, premium: ex.premium ?? undefined } });
      }
      updated.push(...(await applyExtractToPolicy(pol.id, ex, docType === "renewal_notice")));
    } else {
      // No matching policy on this holder — CREATE it from the document
      // (previously the extracted data was silently dropped here).
      const created = await createPolicyFromExtract(clientId, ex, docType);
      if (created) {
        policyId = created.policyId;
        versionId = created.versionId;
        updated.push(...created.labels);
      } else {
        note = `Read policy #${ex.policyNumber}, but that policy number already exists on another holder — stored the file only.`;
      }
    }
  } else if (chosenType === "aadhaar" || chosenType === "pan") {
    note = `Card stored securely (encrypted). For full privacy, ID numbers aren't auto-read — open “Edit vault” and type the ${chosenType === "aadhaar" ? "Aadhaar" : "PAN"} number once; it's then masked & encrypted.`;
  }

  if (!dup) {
    const storagePath = await saveEncryptedFile(bytes);
    const doc = await prisma.document.create({
      data: { clientId, type: docType, label: ex.productName ?? undefined, fileName: file.name, mimeType: file.type || "application/pdf", sizeBytes: file.size, storagePath, policyId: policyId ?? undefined, policyVersionId: versionId ?? undefined },
    });
    if (versionId && docType === "renewal_notice") await prisma.policyVersion.update({ where: { id: versionId }, data: { renewalNoticeDocId: doc.id } });
    if (versionId && docType === "policy_copy") await prisma.policyVersion.update({ where: { id: versionId }, data: { policyCopyDocId: doc.id } });
  }

  revalidatePath(`/clients/${clientId}`);
  return { fileName: file.name, docType, duplicate: !!dup, updated, matched: !!policyId, note };
}

export async function deleteDocument(id: string, clientId: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (doc) {
    await deleteStoredFile(doc.storagePath);
    await prisma.document.delete({ where: { id } });
  }
  revalidatePath(`/clients/${clientId}`);
}

/** Parse "Name (Relation)" lines (newline- or semicolon-separated) into members. */
function parseDob(v: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const d = new Date(v); return isNaN(+d) ? null : d; }
  const m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; const d = new Date(`${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`); return isNaN(+d) ? null : d; }
  return null;
}

function parseMembers(raw: string | undefined): { name: string; relation: string | null; dob: Date | null }[] {
  if (!raw) return [];
  return raw
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      let s = line;
      let dob: Date | null = null;
      // optional trailing birthday: "Name (Relation) 2010-05-12" or "… 12/05/2010"
      const dm = s.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\s*$/);
      if (dm) { dob = parseDob(dm[1]); if (dob) s = s.slice(0, dm.index).trim(); }
      const mm = s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
      const base = mm ? { name: mm[1].trim(), relation: mm[2].trim() || null } : { name: s, relation: null };
      return { ...base, dob };
    });
}

async function insertPolicy(clientId: string, fd: FormData) {
  const policyNumber = str(fd, "policyNumber");
  const line = str(fd, "line") ?? "health";
  const renewalDate = dateVal(fd, "renewalDate");
  if (!policyNumber || !renewalDate) throw new Error("Policy number and renewal/due date are required");
  const startDate = dateVal(fd, "startDate") ?? renewalDate;
  const premium = numVal(fd, "premium") ?? 0;
  const deductibleStr = str(fd, "deductible");

  const members = parseMembers(str(fd, "insuredMembers"));
  const allClients = members.length ? await prisma.client.findMany({ select: { id: true, name: true } }) : [];
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

  await prisma.policy.create({
    data: {
      clientId,
      line,
      carrier: str(fd, "carrier") ?? "",
      policyNumber,
      planName: str(fd, "planName"),
      variant: str(fd, "variant"),
      sumAssured: numVal(fd, "sumAssured") ?? 0,
      premium,
      deductible: deductibleStr !== undefined ? numVal(fd, "deductible") ?? 0 : null,
      frequency: str(fd, "frequency") ?? "annual",
      paymentMode: str(fd, "paymentMode") ?? "online",
      tenureYears: numVal(fd, "tenureYears") ? Math.round(numVal(fd, "tenureYears")!) : null,
      firstInception: dateVal(fd, "firstInception"),
      startDate,
      renewalDate,
      maturityDate: dateVal(fd, "maturityDate"),
      previousPolicyNumber: str(fd, "previousPolicyNumber"),
      renewalUrl: str(fd, "renewalUrl"),
      status: str(fd, "status") ?? "active",
      nomineeName: str(fd, "nomineeName"),
      nomineeRelation: str(fd, "nomineeRelation"),
      source: "manual",
      renewals: { create: { dueDate: renewalDate, amount: premium, status: "pending" } },
      insuredMembers: {
        create: members.map((m) => ({ name: m.name, relation: m.relation, dob: m.dob, clientId: allClients.find((c) => norm(c.name) === norm(m.name))?.id })),
      },
      versions: {
        create: {
          policyNumber,
          yearLabel: `${startDate.getFullYear()}-${String((startDate.getFullYear() + 1) % 100).padStart(2, "0")}`,
          premium,
          sumInsured: numVal(fd, "sumAssured") ?? 0,
          startDate,
          endDate: renewalDate,
          dueDate: renewalDate,
          status: str(fd, "status") ?? "active",
          previousPolicyNumber: str(fd, "previousPolicyNumber"),
          source: "manual",
        },
      },
    },
  });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/policies");
}

export async function createPolicy(fd: FormData) {
  const clientId = str(fd, "clientId");
  if (!clientId) throw new Error("Missing client");
  await insertPolicy(clientId, fd);
  redirect(`/clients/${clientId}`);
}

/** Add a policy from the Policies page — to an existing client or a new one. */
export async function addPolicyFromList(fd: FormData) {
  let clientId = str(fd, "clientId");
  const newName = str(fd, "newClientName");
  if (!clientId && newName) {
    const c = await prisma.client.create({
      data: { name: newName, phone: str(fd, "newClientPhone") ?? "", vault: { create: {} } },
    });
    clientId = c.id;
  }
  if (!clientId) throw new Error("Pick a client or enter a new client name");
  await insertPolicy(clientId, fd);
  redirect(`/clients/${clientId}`);
}

export async function updateClient(fd: FormData) {
  const id = str(fd, "id");
  if (!id) throw new Error("Missing client");

  let householdId = str(fd, "householdId");
  const newHousehold = str(fd, "newHousehold");
  if (!householdId && newHousehold) {
    const h = await prisma.household.create({ data: { name: newHousehold } });
    householdId = h.id;
  }

  await prisma.client.update({
    where: { id },
    data: {
      name: str(fd, "name"),
      phone: str(fd, "phone") ?? "",
      altPhone: str(fd, "altPhone") ?? null,
      email: str(fd, "email") ?? null,
      address: str(fd, "address") ?? null,
      dob: dateVal(fd, "dob") ?? null,
      occupation: str(fd, "occupation") ?? null,
      incomeBand: str(fd, "incomeBand") ?? null,
      gender: str(fd, "gender") ?? null,
      relationship: str(fd, "relationship") ?? null,
      tags: str(fd, "tags") ?? null,
      instagram: str(fd, "instagram") ?? null,
      linkedin: str(fd, "linkedin") ?? null,
      facebook: str(fd, "facebook") ?? null,
      householdId: householdId ?? null,
    },
  });
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

/** Soft-delete: archive (recoverable). Data is retained, just hidden from lists. */
export async function archiveClient(id: string) {
  await prisma.client.update({ where: { id }, data: { archivedAt: new Date() } });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function restoreClient(id: string) {
  await prisma.client.update({ where: { id }, data: { archivedAt: null } });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}

/** Permanent delete — only meant for a client already marked as left (archived).
 *  Removes the client and everything attached (policies cascade). Irreversible. */
export async function deleteClientPermanently(id: string) {
  const c = await prisma.client.findUnique({ where: { id }, select: { archivedAt: true } });
  if (!c) return;
  if (!c.archivedAt) throw new Error("Mark the client as left first, then delete permanently.");
  // Null out the optional lead link (no cascade), then delete — policies,
  // documents, vault, tasks, etc. cascade via their onDelete rules.
  await prisma.lead.updateMany({ where: { clientId: id }, data: { clientId: null } });
  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function updatePolicy(fd: FormData) {
  const id = str(fd, "id");
  const clientId = str(fd, "clientId");
  const renewalDate = dateVal(fd, "renewalDate");
  if (!id || !clientId || !renewalDate) throw new Error("Missing required policy fields");

  const members = parseMembers(str(fd, "insuredMembers"));
  const allClients = members.length ? await prisma.client.findMany({ select: { id: true, name: true } }) : [];
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const deductibleStr = str(fd, "deductible");

  await prisma.policy.update({
    where: { id },
    data: {
      line: str(fd, "line"),
      carrier: str(fd, "carrier") ?? "",
      planName: str(fd, "planName") ?? null,
      variant: str(fd, "variant") ?? null,
      sumAssured: numVal(fd, "sumAssured") ?? 0,
      premium: numVal(fd, "premium") ?? 0,
      deductible: deductibleStr !== undefined ? numVal(fd, "deductible") ?? 0 : null,
      frequency: str(fd, "frequency") ?? "annual",
      paymentMode: str(fd, "paymentMode") ?? "online",
      tenureYears: numVal(fd, "tenureYears") ? Math.round(numVal(fd, "tenureYears")!) : null,
      firstInception: dateVal(fd, "firstInception") ?? null,
      startDate: dateVal(fd, "startDate") ?? renewalDate,
      renewalDate,
      maturityDate: dateVal(fd, "maturityDate") ?? null,
      previousPolicyNumber: str(fd, "previousPolicyNumber") ?? null,
      renewalUrl: str(fd, "renewalUrl") ?? null,
      status: str(fd, "status") ?? "active",
      nomineeName: str(fd, "nomineeName") ?? null,
      nomineeRelation: str(fd, "nomineeRelation") ?? null,
    },
  });
  await prisma.policyInsured.deleteMany({ where: { policyId: id } });
  for (const m of members) {
    await prisma.policyInsured.create({ data: { policyId: id, name: m.name, relation: m.relation, dob: m.dob, clientId: allClients.find((c) => norm(c.name) === norm(m.name))?.id } });
  }
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/policies");
}

export async function deletePolicy(id: string, clientId: string) {
  await prisma.policy.delete({ where: { id } });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/policies");
}
