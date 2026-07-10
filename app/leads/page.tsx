import { prisma } from "@/lib/db";
import { LeadsBoard } from "@/components/leads/LeadsBoard";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({ orderBy: [{ createdAt: "desc" }] });
  const shaped = leads.map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    source: l.source,
    stage: l.stage,
    interest: l.interest,
    expectedPremium: l.expectedPremium,
    notes: l.notes,
    clientId: l.clientId,
    updatedAt: l.updatedAt.toISOString(),
    quotedAt: l.quotedAt?.toISOString() ?? null,
  }));
  return <LeadsBoard leads={shaped} />;
}
