import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// ──────────────────────────────────────────────────────────────
// Claude wrapper (Phase 4).
// One place for: the API key check, the model, the safety redactor,
// and the two call shapes the app uses (complete + streamText).
//
// PRIVACY CONTRACT: Aadhaar/PAN and any vault data must NEVER reach
// Claude. The app already builds AI context from non-sensitive fields,
// and `redact()` below is a second line of defence — every outbound
// string is scrubbed of anything Aadhaar- or PAN-shaped before it
// leaves the machine. AI calls go only to Anthropic, on the agent's
// own key; nothing is sent when the key is blank.
// ──────────────────────────────────────────────────────────────

// Smart model for the chat assistant (reasoning over the whole book).
export const MODEL = "claude-opus-4-8";
// Cheaper, fast model for short structured tasks (briefing rewrite, message
// drafting) — ~5× cheaper than Opus, plenty for these. Swap back to MODEL here
// if you ever want top quality on drafts.
export const MODEL_FAST = "claude-haiku-4-5";

let _client: Anthropic | null = null;

/** True when the agent has pasted their Anthropic key into `.env`. */
export function aiAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0;
}

function client(): Anthropic {
  if (!aiAvailable()) {
    throw new Error("AI is not configured — add ANTHROPIC_API_KEY to .env to enable it.");
  }
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  return _client;
}

// Aadhaar (12 digits, optionally spaced 4-4-4) and PAN (ABCDE1234F).
const AADHAAR = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
const PAN = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;

/** Defence-in-depth: strip anything Aadhaar/PAN-shaped from any text we send out. */
export function redact(s: string): string {
  return s.replace(AADHAAR, "[redacted-id]").replace(PAN, "[redacted-pan]");
}

/** Shared persona for every AI surface in the CRM. */
export const PERSONA =
  "You are the AI assistant inside a CRM used by Vignesh, a solo life & health " +
  "insurance agent in India (he sells Life/Term and Health policies). You help him " +
  "act on his book of business. Be concise, warm, and practical. Use Indian Rupee " +
  "formatting (₹, lakhs where natural) and Indian context. You can draft WhatsApp " +
  "messages in English or Telugu when asked. Never reveal, guess, or fabricate Aadhaar " +
  "or PAN numbers — those are private and are never given to you.";

type Msg = { role: "user" | "assistant"; content: string };

/**
 * One-shot text response. Used for short, structured tasks
 * (briefing rewrite, message drafting). Thinking is off by default for speed.
 */
export async function complete(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
  thinking?: boolean;
  model?: string;
}): Promise<string> {
  const res = await client().messages.create({
    model: opts.model ?? MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    ...(opts.thinking ? { thinking: { type: "adaptive" as const } } : {}),
    system: redact(opts.system),
    messages: [{ role: "user", content: redact(opts.prompt) }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Streaming response for the embedded assistant. Returns the SDK MessageStream;
 * the route iterates text deltas and forwards them to the browser.
 */
export function streamText(opts: { system: string; messages: Msg[]; maxTokens?: number; thinking?: boolean }) {
  return client().messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2048,
    ...(opts.thinking ? { thinking: { type: "adaptive" as const } } : {}),
    system: redact(opts.system),
    messages: opts.messages.map((m) => ({ role: m.role, content: redact(m.content) })),
  });
}

/**
 * One assistant turn that MAY call a tool. Returns the model's text plus the
 * first tool call (if any). The caller decides whether to execute it — for
 * action tools we surface it to the user for confirmation instead of running it.
 */
export async function messageWithTools(opts: { system: string; messages: Msg[]; tools: Anthropic.Tool[]; maxTokens?: number }) {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    thinking: { type: "adaptive" as const },
    system: redact(opts.system),
    tools: opts.tools,
    messages: opts.messages.map((m) => ({ role: m.role, content: redact(m.content) })),
  });
  const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use") ?? null;
  return { text, tool: toolUse ? { name: toolUse.name, input: toolUse.input as Record<string, unknown> } : null };
}

/** Pull the first JSON value (object or array) out of a model response. */
export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.search(/[[{]/);
  if (start === -1) return null;
  // find the matching close by scanning to the last bracket of the same kind
  const open = raw[start];
  const close = open === "[" ? "]" : "}";
  const end = raw.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
