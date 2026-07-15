import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { PoliciesView } from "@/components/clients/PoliciesView";

export const dynamic = "force-dynamic";

// Server-side search + pagination so the page stays fast at 10k+ policies —
// the browser only ever receives one page of rows, and search hits the DB.
const PAGE_SIZE = 50;
const RECENT_DAYS = 30;

export default async function PoliciesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; view?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const view = sp.view === "all" ? "all" : "recent";
  const page = Math.max(1, Number(sp.page) || 1);
  const recentCutoff = new Date(Date.now() - RECENT_DAYS * 86_400_000);

  const where: Prisma.PolicyWhereInput = {
    deletedAt: null,
    client: { archivedAt: null, deletedAt: null },
    ...(view === "recent" ? { startDate: { gte: recentCutoff } } : {}),
    ...(q
      ? {
          OR: [
            { policyNumber: { contains: q } },
            { carrier: { contains: q } },
            { planName: { contains: q } },
            { variant: { contains: q } },
            { client: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, policies, clients, premiumAgg] = await Promise.all([
    prisma.policy.count({ where }),
    prisma.policy.findMany({
      where,
      orderBy: { startDate: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.client.findMany({ where: { archivedAt: null, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.policy.aggregate({ where: { ...where, status: "active" }, _sum: { premium: true } }),
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

  return (
    <PoliciesView
      policies={shaped}
      clients={clients}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      q={q}
      view={view}
      activePremium={Math.round(premiumAgg._sum.premium ?? 0)}
    />
  );
}
