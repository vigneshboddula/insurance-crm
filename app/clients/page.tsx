import Link from "next/link";
import { Trophy } from "lucide-react";
import { prisma } from "@/lib/db";
import { ClientsView } from "@/components/clients/ClientsView";
import { clientMissing } from "@/lib/completeness";
import { getClientValueRanking } from "@/lib/ltv";
import { inr } from "@/lib/format";

export const dynamic = "force-dynamic";

const TIER_TONE: Record<string, string> = { Platinum: "var(--accent-700)", Gold: "var(--amber-700)", Silver: "var(--ink-2)", Bronze: "var(--ink-3)" };

export default async function ClientsPage() {
  const topClients = await getClientValueRanking(5);
  const [clients, households, archived] = await Promise.all([
    prisma.client.findMany({
      where: { archivedAt: null, deletedAt: null },
      orderBy: { name: "asc" },
      include: { household: true, _count: { select: { policies: true } } },
    }),
    prisma.household.findMany({ orderBy: { name: "asc" } }),
    prisma.client.findMany({ where: { archivedAt: { not: null }, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, phone: true } }),
  ]);

  const shaped = clients.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    household: c.household?.name ?? null,
    tags: c.tags,
    policyCount: c._count.policies,
    needsReview: clientMissing(c).length,
  }));

  return (
    <div className="space-y-4">
      {topClients.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Trophy size={15} style={{ color: "var(--amber-700)" }} /> Top clients by value</h2>
          <ol className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-5">
            {topClients.map((t, i) => (
              <li key={t.id}>
                <Link href={`/clients/${t.id}`} className="flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-surface-2" style={{ background: "var(--surface-2)" }}>
                  <span className="text-xs font-semibold text-ink-4">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{t.name}</div>
                    <div className="text-[11px] tnum" style={{ color: TIER_TONE[t.tier] }}>★ {t.tier} · {inr(t.annual)}/yr</div>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
      <ClientsView clients={shaped} households={households.map((h) => ({ id: h.id, name: h.name }))} archived={archived} />
    </div>
  );
}
