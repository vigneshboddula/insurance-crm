// Records are never blocked on missing data — they save, then get flagged
// "Needs review" with a list of what's still required. These helpers compute
// that list so the same rules drive badges on the list, profile, and importer.

type ClientLike = {
  email?: string | null; dob?: Date | string | null; altPhone?: string | null;
  phone?: string | null;
};

type PolicyLike = {
  carrier?: string | null; variant?: string | null; sumAssured?: number | null;
  premium?: number | null; deductible?: number | null; firstInception?: Date | string | null;
  tenureYears?: number | null; renewalDate?: Date | string | null;
  insuredMembers?: unknown[];
};

const has = (v: unknown) => v !== null && v !== undefined && v !== "";

export function clientMissing(c: ClientLike): string[] {
  const m: string[] = [];
  if (!has(c.phone)) m.push("Phone");
  if (!has(c.email)) m.push("Email");
  if (!has(c.dob)) m.push("Date of birth");
  if (!has(c.altPhone)) m.push("Alternative phone");
  return m;
}

export function policyMissing(p: PolicyLike): string[] {
  const m: string[] = [];
  if (!has(p.carrier)) m.push("Insurer");
  if (!has(p.variant)) m.push("Policy variant");
  if (!p.sumAssured) m.push("Sum insured");
  if (!p.premium) m.push("Premium");
  if (p.deductible === null || p.deductible === undefined) m.push("Confirm deductible");
  if (!has(p.firstInception)) m.push("First policy inception date");
  if (!has(p.tenureYears)) m.push("Tenure");
  if (!has(p.renewalDate)) m.push("Due date");
  if (!p.insuredMembers || p.insuredMembers.length === 0) m.push("Insured members");
  return m;
}
