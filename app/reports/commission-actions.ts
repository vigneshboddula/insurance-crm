"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

export type CommissionImportResult = {
  total: number;
  matched: number;
  notFound: { policyNumber: string; amount: number }[];
};

/** Import a commission statement Excel. Expects columns: policy number +
 *  commission amount. Matches by policy number (digits-only comparison),
 *  upserts the Commission record with receivedAmount. */
export async function importCommissionStatement(fd: FormData): Promise<CommissionImportResult> {
  const file = fd.get("file") as File;
  if (!file) throw new Error("No file");
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  if (!rows.length) throw new Error("Empty spreadsheet");

  const keys = Object.keys(rows[0]);
  const kPol = findKey(keys, "policy", "certificate", "proposal");
  const kAmt = findKey(keys, "commission", "amount", "payout", "earned");
  if (!kPol || !kAmt) throw new Error(`Could not find policy-number and commission-amount columns. Found: ${keys.join(", ")}`);

  const digits = (s: string) => s.replace(/\D/g, "");

  const policies = await prisma.policy.findMany({
    where: { deletedAt: null },
    select: { id: true, policyNumber: true },
  });
  const byDigits = new Map<string, string>();
  for (const p of policies) byDigits.set(digits(p.policyNumber), p.id);

  let matched = 0;
  const notFound: { policyNumber: string; amount: number }[] = [];

  for (const row of rows) {
    const polRaw = String(row[kPol] ?? "").trim();
    const amt = Number(String(row[kAmt] ?? "0").replace(/[₹,\s]/g, ""));
    if (!polRaw || isNaN(amt) || amt <= 0) continue;

    const polDigits = digits(polRaw);
    const policyId = byDigits.get(polDigits);
    if (!policyId) {
      // Try relaxed: match if one is a prefix of the other (HDFC 16→19 digits)
      let found: string | undefined;
      for (const [k, v] of byDigits) {
        if (k.startsWith(polDigits) || polDigits.startsWith(k)) { found = v; break; }
      }
      if (!found) { notFound.push({ policyNumber: polRaw, amount: amt }); continue; }
      await upsertCommission(found, amt);
      matched++;
    } else {
      await upsertCommission(policyId, amt);
      matched++;
    }
  }

  revalidatePath("/reports");
  return { total: rows.length, matched, notFound };
}

async function upsertCommission(policyId: string, amount: number) {
  const existing = await prisma.commission.findUnique({ where: { policyId } });
  if (existing) {
    await prisma.commission.update({ where: { policyId }, data: { receivedAmount: amount, status: "received" } });
  } else {
    const policy = await prisma.policy.findUnique({ where: { id: policyId }, select: { premium: true, line: true } });
    const { expectedRate } = await import("@/lib/commissions");
    const expected = Math.round((policy?.premium ?? 0) * expectedRate(policy?.line ?? "health"));
    await prisma.commission.create({ data: { policyId, expectedAmount: expected, receivedAmount: amount, status: "received" } });
  }
}

function findKey(keys: string[], ...needles: string[]): string | undefined {
  return keys.find((k) => needles.some((n) => k.toLowerCase().includes(n)));
}
