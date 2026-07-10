"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

// Contacts bulk-update. Upload the filled-in Excel (downloaded from
// /api/contacts/export): each row is matched by Policy Number, and the client
// behind that policy gets their Phone / Gmail updated. Only non-empty cells
// overwrite — blanks never wipe existing data.

const digits = (s: string) => s.replace(/\D/g, "");
const cell = (v: unknown) => (v == null ? "" : String(v).trim());

function findKey(keys: string[], ...wants: string[]): string | undefined {
  return keys.find((k) => wants.some((w) => k.toLowerCase().replace(/[^a-z]/g, "").includes(w)));
}

export type ContactImportResult = { total: number; updated: number; notFound: { policyNumber: string; name: string }[] };

export async function importContacts(fd: FormData): Promise<ContactImportResult> {
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose an Excel file");
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  if (!rows.length) return { total: 0, updated: 0, notFound: [] };

  const keys = Object.keys(rows[0]);
  const kPol = findKey(keys, "policynumber", "policyno", "policy");
  // NB: don't match on "number" here — "Policy Number" contains it. Use phone/mobile only.
  const kPhone = findKey(keys.filter((k) => k !== kPol), "phone", "mobile");
  const kMail = findKey(keys, "gmail", "email");
  if (!kPol) throw new Error("No 'Policy Number' column found in the sheet");

  // map every policy number → its client id (normalized, tolerant to spacing)
  const policies = await prisma.policy.findMany({ select: { policyNumber: true, clientId: true } });
  const byNum = new Map<string, string>();
  for (const p of policies) byNum.set(digits(p.policyNumber), p.clientId);

  let updated = 0;
  const notFound: { policyNumber: string; name: string }[] = [];
  const touched = new Set<string>();

  for (const r of rows) {
    const pol = cell(r[kPol]);
    if (!pol) continue;
    const clientId = byNum.get(digits(pol));
    if (!clientId) { notFound.push({ policyNumber: pol, name: cell(r["Name"] ?? r["name"]) }); continue; }
    if (touched.has(clientId)) continue; // a client can appear on several policy rows — update once
    const data: Record<string, unknown> = {};
    const phone = kPhone ? cell(r[kPhone]) : "";
    const mail = kMail ? cell(r[kMail]) : "";
    if (phone) data.phone = phone;
    if (mail) data.email = mail;
    if (Object.keys(data).length) { await prisma.client.update({ where: { id: clientId }, data }); updated++; touched.add(clientId); }
  }

  revalidatePath("/contacts");
  revalidatePath("/clients");
  return { total: rows.length, updated, notFound };
}

/** Inline edit a single contact (from the Contacts table), keyed by policy number. */
export async function updateContact(policyNumber: string, phone: string, email: string): Promise<{ ok: boolean }> {
  const pol = await prisma.policy.findUnique({ where: { policyNumber }, select: { clientId: true } });
  if (!pol) return { ok: false };
  await prisma.client.update({ where: { id: pol.clientId }, data: { phone: phone.trim(), email: email.trim() || null } });
  revalidatePath("/contacts");
  revalidatePath("/clients");
  return { ok: true };
}
