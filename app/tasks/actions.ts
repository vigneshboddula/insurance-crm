"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

function str(fd: FormData, key: string): string | undefined {
  const v = fd.get(key);
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}

export async function createTask(fd: FormData) {
  const title = str(fd, "title");
  const due = str(fd, "dueDate");
  if (!title) throw new Error("Title is required");
  await prisma.task.create({
    data: {
      title,
      dueDate: due ? new Date(due) : new Date(),
      priority: str(fd, "priority") ?? "medium",
      type: str(fd, "type") ?? "follow_up",
      clientId: str(fd, "clientId"),
      policyId: str(fd, "policyId"),
      notes: str(fd, "notes"),
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function updateTask(fd: FormData) {
  const id = str(fd, "id");
  if (!id) throw new Error("Missing task");
  const due = str(fd, "dueDate");
  await prisma.task.update({
    where: { id },
    data: {
      title: str(fd, "title"),
      dueDate: due ? new Date(due) : undefined,
      priority: str(fd, "priority"),
      type: str(fd, "type"),
      clientId: str(fd, "clientId") ?? null,
      policyId: str(fd, "policyId") ?? null,
      notes: str(fd, "notes") ?? null,
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function toggleTask(id: string, done: boolean) {
  await prisma.task.update({
    where: { id },
    data: { done, status: done ? "completed" : "open", completedAt: done ? new Date() : null },
  });
  revalidatePath("/tasks");
  revalidatePath("/");
}

/** Set a task's workflow status (Completed / Needs Review / Call / Other). */
export async function setTaskStatus(id: string, status: string) {
  const done = status === "completed";
  await prisma.task.update({
    where: { id },
    data: { status, done, completedAt: done ? new Date() : null },
  });
  revalidatePath("/tasks");
  revalidatePath("/");
}

export type TaskSnapshot = {
  id: string; title: string; type: string; priority: string; status: string;
  dueDate: string; done: boolean; completedAt: string | null;
  clientId: string | null; policyId: string | null; notes: string | null; createdAt: string;
};

/** Delete a task, returning a snapshot so the UI can offer Undo. */
export async function deleteTask(id: string): Promise<TaskSnapshot | null> {
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return null;
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
  revalidatePath("/");
  return {
    id: t.id, title: t.title, type: t.type, priority: t.priority, status: t.status,
    dueDate: t.dueDate.toISOString(), done: t.done, completedAt: t.completedAt?.toISOString() ?? null,
    clientId: t.clientId, policyId: t.policyId, notes: t.notes, createdAt: t.createdAt.toISOString(),
  };
}

/** Undo a delete: recreate the task exactly as it was (same id). */
export async function restoreTask(s: TaskSnapshot) {
  await prisma.task.create({
    data: {
      id: s.id, title: s.title, type: s.type, priority: s.priority, status: s.status,
      dueDate: new Date(s.dueDate), done: s.done, completedAt: s.completedAt ? new Date(s.completedAt) : null,
      clientId: s.clientId, policyId: s.policyId, notes: s.notes, createdAt: new Date(s.createdAt),
    },
  });
  revalidatePath("/tasks");
  revalidatePath("/");
}
