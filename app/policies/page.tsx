import { prisma } from "@/lib/db";
import { PoliciesView } from "@/components/clients/PoliciesView";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const [policies, clients] = await Promise.all([
    prisma.policy.findMany({
      where: { deletedAt: null, client: { archivedAt: null } },
      orderBy: { startDate: "desc" },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.client.findMany({ where: { archivedAt: null, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const shaped = policies.map((p) => ({
    id: p.id,
    clientId: p.clientId,
    clientName: p.client.name,
    line: p.line,
    carrier: p.carrier,
    policyNumber: p.policyNumber,
    planName: p.planName,
    premium: p.premium,
    sumAssured: p.sumAssured,
    renewalDate: p.renewalDate.toISOString(),
    startDate: p.startDate.toISOString(),
    status: p.status,
  }));

  return <PoliciesView policies={shaped} clients={clients} />;
}
