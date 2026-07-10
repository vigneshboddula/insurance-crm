import { NextRequest } from "next/server";
import { aiAvailable, complete, PERSONA, MODEL_FAST } from "@/lib/ai";
import { clientFacts } from "@/lib/ai-context";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

type Body = {
  instruction?: string; // free-text "what should this say"
  purpose?: string; // e.g. "renewal reminder", "birthday wish", "cross-sell health"
  language?: "english" | "telugu";
  clientId?: string;
};

export async function POST(req: NextRequest) {
  if (!aiAvailable()) {
    return Response.json({ error: "AI not configured. Add ANTHROPIC_API_KEY to .env." }, { status: 503 });
  }

  const { instruction, purpose, language = "english", clientId } = (await req.json()) as Body;
  const ask = (instruction ?? purpose ?? "").trim();
  if (!ask) return Response.json({ error: "Tell me what the message should say." }, { status: 400 });

  let facts: string | null = null;
  if (clientId) facts = await clientFacts(clientId);

  const lang = language === "telugu" ? "Telugu" : "English";
  const system =
    PERSONA +
    `\n\nDraft ONE WhatsApp message in ${lang}. It is from Vignesh (the agent) to a client. ` +
    "Warm, respectful, concise — the way a trusted local agent writes. No markdown, no subject line, " +
    "no placeholders left unfilled unless a detail is genuinely unknown. Output ONLY the message text.";

  const prompt =
    `What the message should do: ${ask}` +
    (facts ? `\n\nClient details (use the real name and figures):\n${facts}` : "");

  try {
    const text = await complete({ system, prompt, maxTokens: 600, model: MODEL_FAST });
    return Response.json({ text });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Draft failed." }, { status: 500 });
  }
}
