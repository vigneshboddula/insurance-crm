import { prisma } from "@/lib/db";
import { ContactsView, type Contact } from "@/components/contacts/ContactsView";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const policies = await prisma.policy.findMany({
    where: { client: { archivedAt: null } },
    orderBy: [{ client: { name: "asc" } }, { renewalDate: "asc" }],
    include: { client: { select: { name: true, phone: true, email: true } } },
  });

  const contacts: Contact[] = policies.map((p) => ({
    policyNumber: p.policyNumber,
    name: p.client.name,
    phone: p.client.phone || "",
    email: p.client.email || "",
    carrier: p.carrier || "",
    policyType: p.policyType,
  }));

  const carriers = [...new Set(policies.map((p) => p.carrier).filter(Boolean))].sort();

  return <ContactsView contacts={contacts} carriers={carriers} />;
}
