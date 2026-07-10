import { prisma } from "@/lib/db";
import { CollectionsView } from "@/components/collections/CollectionsView";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const [policies, collections] = await Promise.all([
    prisma.policy.findMany({
      where: { status: "active", client: { archivedAt: null } },
      select: { id: true, premium: true, renewalDate: true, line: true, carrier: true, policyNumber: true, client: { select: { id: true, name: true, phone: true } } },
      orderBy: { renewalDate: "asc" },
    }),
    prisma.collection.findMany(),
  ]);

  const byKey = new Map(collections.map((c) => [`${c.policyId}|${c.cycleDate.toISOString()}`, c]));

  const rows = policies.map((p) => {
    const cycleIso = p.renewalDate.toISOString();
    const rec = byKey.get(`${p.id}|${cycleIso}`);
    const collected = rec?.collectedAmount ?? 0;
    const status = rec?.status ?? "pending";
    return {
      policyId: p.id, clientId: p.client.id, clientName: p.client.name, phone: p.client.phone,
      policyLabel: `${p.carrier}${p.policyNumber ? ` · ${p.policyNumber}` : ""}`, line: p.line,
      amount: p.premium, cycleDate: cycleIso, collected, status, mode: rec?.mode ?? null,
    };
  });

  const expected = rows.reduce((s, r) => s + r.amount, 0);
  const collected = rows.reduce((s, r) => s + r.collected, 0);
  const pending = Math.max(0, expected - collected);

  return <CollectionsView rows={rows} kpis={{ expected, collected, pending }} />;
}
