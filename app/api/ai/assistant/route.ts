import { NextRequest } from "next/server";
import { aiAvailable, messageWithTools, PERSONA } from "@/lib/ai";
import { buildBookContext } from "@/lib/ai-context";
import { ASSISTANT_TOOLS, toPendingAction } from "@/lib/ai-tools";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  if (!aiAvailable()) {
    return Response.json({ error: "AI not configured. Add ANTHROPIC_API_KEY to .env." }, { status: 503 });
  }

  const { messages } = (await req.json()) as { messages: Msg[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "No messages." }, { status: 400 });
  }
  const turns = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12);

  const book = await buildBookContext();
  const system =
    PERSONA +
    "\n\nAnswer questions ONLY from the book snapshot below — never invent a client, number, or policy. " +
    "List people/policies with their relevant figures when asked.\n\n" +
    "You can also ACT for the agent using the tools: send a WhatsApp message, or create a task/reminder. " +
    "When the user asks you to message someone, draft a renewal reminder, or set a reminder, CALL THE TOOL " +
    "with the complete content — do not just describe it. Nothing you propose is sent or saved until the agent " +
    "confirms it on screen, so write the final, ready-to-send text. Use the client's full name exactly as in the book. " +
    "For everything else, answer in text. Keep replies tight.\n\n" +
    book;

  try {
    const { text, tool } = await messageWithTools({ system, messages: turns, tools: ASSISTANT_TOOLS, maxTokens: 1800 });
    const pendingAction = tool ? toPendingAction(tool) : null;
    return Response.json({ text, pendingAction });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "AI request failed." }, { status: 500 });
  }
}
