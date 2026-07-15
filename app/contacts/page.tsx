import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { ContactsView, type Contact } from "@/components/contacts/ContactsView";

export const dynamic = "force-dynamic";

// Server-side filters + search + pagination — stays fast at 10k+ policies.
const PAGE_SIZE = 50;

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; filter?: string; carrier?: string }> }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const filter = sp.filter === "no_phone" || sp.filter === "no_email" ? sp.filter : "all";
  const carrier = (sp.carrier ?? "").trim();
  const page = Math.max(1, Number(sp.page) || 1);

  const clientWhere: Prisma.ClientWhereInput = {
    archivedAt: null,
    deletedAt: null,
    ...(filter === "no_phone" ? { phone: "" } : {}),
    ...(filter === "no_email" ? { OR: [{ email: null }, { email: "" }] } : {}),
  };
  const where: Prisma.PolicyWhereInput = {
    deletedAt: null,
    client: clientWhere,
    ...(carrier ? { carrier: { contains: carrier } } : {}),
    ...(q
      ? {
          OR: [
            { policyNumber: { contains: q } },
            { carrier: { contains: q } },
            { client: { name: { contains: q } } },
            { client: { phone: { contains: q } } },
            { client: { email: { contains: q } } },
          ],
        }
      : {}),
  };

  const activePolicy: Prisma.PolicyWhereInput = { deletedAt: null, client: { archivedAt: null, deletedAt: null } };
  const [total, policies, carriersRaw, allCount, noPhoneCount, noEmailCount] = await Promise.all([
    prisma.policy.count({ where }),
    prisma.policy.findMany({
      where,
      orderBy: [{ client: { name: "asc" } }, { renewalDate: "asc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { client: { select: { name: true, phone: true, email: true } } },
    }),
    prisma.policy.findMany({ where: activePolicy, select: { carrier: true }, distinct: ["carrier"] }),
    prisma.policy.count({ where: activePolicy }),
    prisma.policy.count({ where: { ...activePolicy, client: { archivedAt: null, deletedAt: null, phone: "" } } }),
    prisma.policy.count({ where: { ...activePolicy, client: { archivedAt: null, deletedAt: null, OR: [{ email: null }, { email: "" }] } } }),
  ]);

  const contacts: Contact[] = policies.map((p) => ({
    policyNumber: p.policyNumber,
    name: p.client.name,
    phone: p.client.phone || "",
    email: p.client.email || "",
    carrier: p.carrier || "",
    policyType: p.policyType,
  }));

  const carriers = carriersRaw.map((c) => c.carrier).filter(Boolean).sort();

  return (
    <ContactsView
      contacts={contacts}
      carriers={carriers}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      q={q}
      filter={filter}
      carrier={carrier}
      counts={{ all: allCount, noPhone: noPhoneCount, noEmail: noEmailCount }}
    />
  );
}
