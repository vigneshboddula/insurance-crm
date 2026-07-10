import { prisma } from "@/lib/db";
import { CommLog } from "@/components/communications/CommLog";

export const dynamic = "force-dynamic";

export default async function CommunicationsPage() {
  const [comms, clients] = await Promise.all([
    prisma.communication.findMany({
      orderBy: { occurredAt: "desc" },
      take: 500,
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const shaped = comms
    .filter((c) => c.client)
    .map((c) => ({
      id: c.id,
      clientId: c.clientId,
      clientName: c.client.name,
      channel: c.channel,
      direction: c.direction,
      subject: c.subject,
      body: c.body,
      status: c.status,
      occurredAt: c.occurredAt.toISOString(),
    }));

  return <CommLog comms={shaped} clients={clients} />;
}
