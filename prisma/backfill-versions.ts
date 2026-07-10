// One-off, idempotent: create an initial PolicyVersion for any policy that has none.
// Safe to run multiple times. Run: npx tsx prisma/backfill-versions.ts
import { PrismaClient } from "@prisma/client";
try { (process as any).loadEnvFile?.(); } catch {}
const prisma = new PrismaClient();

async function main() {
  const policies = await prisma.policy.findMany({ include: { versions: true } });
  let created = 0;
  for (const p of policies) {
    if (p.versions.length > 0) continue;
    await prisma.policyVersion.create({
      data: {
        policyId: p.id,
        policyNumber: p.policyNumber,
        yearLabel: `${p.startDate.getFullYear()}-${String((p.startDate.getFullYear() + 1) % 100).padStart(2, "0")}`,
        premium: p.premium,
        sumInsured: p.sumAssured,
        startDate: p.startDate,
        endDate: p.renewalDate,
        dueDate: p.renewalDate,
        status: p.status === "active" ? "active" : p.status,
        previousPolicyNumber: p.previousPolicyNumber,
        source: p.source ?? "manual",
      },
    });
    created++;
  }
  console.log(`Backfill complete. Versions created: ${created} (policies: ${policies.length})`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
