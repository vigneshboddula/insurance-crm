import { prisma } from "@/lib/db";
import { TasksView } from "@/components/tasks/TasksView";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, clients] = await Promise.all([
    prisma.task.findMany({ orderBy: [{ done: "asc" }, { dueDate: "asc" }], include: { client: { select: { id: true, name: true, phone: true } } } }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const shaped = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate.toISOString(),
    priority: t.priority,
    type: t.type,
    done: t.done,
    status: t.status,
    notes: t.notes,
    clientId: t.clientId,
    clientName: t.client?.name ?? null,
    clientPhone: t.client?.phone ?? null,
  }));

  return <TasksView tasks={shaped} clients={clients} />;
}
