import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { waState, waSend } from "@/lib/whatsapp/client";

// ──────────────────────────────────────────────────────────────
// Action tools the AI Assistant can PROPOSE. They are never executed by the
// model turn — the route surfaces the proposed action to the agent, who must
// confirm before `runAction` actually does anything.
// ──────────────────────────────────────────────────────────────

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  {
    name: "send_whatsapp",
    description:
      "Propose sending a WhatsApp message to one client. The drafted message is shown to the agent for confirmation BEFORE anything is sent — you are not sending it yourself, you are proposing it. Use the client's full name exactly as it appears in the book snapshot. Write the complete, ready-to-send message in the client's language if known.",
    input_schema: {
      type: "object",
      properties: {
        client_name: { type: "string", description: "Full name of the client, as in the book" },
        message: { type: "string", description: "The complete message text to send" },
      },
      required: ["client_name", "message"],
    },
  },
  {
    name: "create_task",
    description:
      "Propose creating a follow-up task/reminder for the agent. Shown for confirmation before it is created.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "What the task is" },
        client_name: { type: "string", description: "Optional client this relates to" },
        due_in_days: { type: "integer", description: "Days from today the task is due (0 = today)" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["title"],
    },
  },
];

export type PendingAction =
  | { type: "send_whatsapp"; client_name: string; message: string; label: string }
  | { type: "create_task"; title: string; client_name?: string; due_in_days?: number; priority?: string; label: string };

/** Turn a model tool call into a confirmable pending action (with a human label). */
export function toPendingAction(tool: { name: string; input: Record<string, unknown> }): PendingAction | null {
  if (tool.name === "send_whatsapp") {
    const client_name = String(tool.input.client_name ?? "");
    const message = String(tool.input.message ?? "");
    if (!client_name || !message) return null;
    return { type: "send_whatsapp", client_name, message, label: `Send WhatsApp to ${client_name}` };
  }
  if (tool.name === "create_task") {
    const title = String(tool.input.title ?? "");
    if (!title) return null;
    return {
      type: "create_task",
      title,
      client_name: tool.input.client_name ? String(tool.input.client_name) : undefined,
      due_in_days: typeof tool.input.due_in_days === "number" ? tool.input.due_in_days : undefined,
      priority: tool.input.priority ? String(tool.input.priority) : undefined,
      label: `Create task: ${title}`,
    };
  }
  return null;
}

async function resolveClient(name: string) {
  const matches = await prisma.client.findMany({
    where: { archivedAt: null, name: { contains: name } },
    select: { id: true, name: true, phone: true },
    take: 5,
  });
  if (!matches.length) return null;
  // prefer an exact (case-insensitive) name match, else the shortest name
  const exact = matches.find((m) => m.name.toLowerCase() === name.toLowerCase());
  return exact ?? matches.sort((a, b) => a.name.length - b.name.length)[0];
}

/** Execute a confirmed action. Returns a short result message. */
export async function runAction(action: PendingAction): Promise<{ ok: boolean; message: string }> {
  if (action.type === "send_whatsapp") {
    const c = await resolveClient(action.client_name);
    if (!c) return { ok: false, message: `Couldn't find a client called "${action.client_name}".` };
    if (!c.phone) return { ok: false, message: `${c.name} has no phone number on file.` };
    if (waState().status !== "ready") return { ok: false, message: "WhatsApp isn't connected — open the WhatsApp page and Connect first." };
    const res = await waSend(c.phone, action.message);
    if (!res.ok) return { ok: false, message: res.error ?? "Send failed." };
    await prisma.communication.create({
      data: { clientId: c.id, channel: "whatsapp", direction: "outbound", subject: "AI assistant message", body: action.message, status: "sent" },
    });
    return { ok: true, message: `Sent on WhatsApp to ${c.name}.` };
  }

  if (action.type === "create_task") {
    const c = action.client_name ? await resolveClient(action.client_name) : null;
    const due = new Date();
    due.setDate(due.getDate() + (action.due_in_days ?? 1));
    await prisma.task.create({
      data: { title: action.title, dueDate: due, priority: action.priority ?? "medium", type: "follow_up", clientId: c?.id },
    });
    return { ok: true, message: `Task created${c ? ` for ${c.name}` : ""}, due ${due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.` };
  }

  return { ok: false, message: "Unknown action." };
}
