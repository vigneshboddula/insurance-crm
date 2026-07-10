import "server-only";
import { prisma } from "@/lib/db";
import { aiAvailable, complete, extractJson, MODEL_FAST, PERSONA } from "@/lib/ai";
import { waSend } from "@/lib/whatsapp/client";

// ──────────────────────────────────────────────────────────────
// Phase 3 · items 14 & 15 — two-way WhatsApp: inbound triage + self-service.
//
// Registered as the WhatsApp "message" handler (lib/whatsapp/client.ts). For
// every inbound message from a KNOWN client it:
//   • logs it to the communication history (direction "inbound"),
//   • (inboundMode "triage") classifies intent and creates the right task —
//       renewed → verify & mark · needs time → follow-up · question → reply,
//   • (selfServiceMode on) answers simple self-service asks — claim status,
//       or flags a policy-copy request — for KNOWN numbers only (whitelist),
//       and NEVER discloses vault data (Aadhaar/PAN).
// All OFF by default. Unknown numbers are ignored (never auto-replied to).
// ──────────────────────────────────────────────────────────────

type Intent = "renewed" | "needs_time" | "question" | "policy_copy" | "claim_status" | "other";

function last10(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.slice(-10);
}

async function findClient(fromDigits: string) {
  const l10 = last10(fromDigits);
  if (l10.length < 10) return null;
  return prisma.client.findFirst({
    where: { archivedAt: null, OR: [{ phone: { contains: l10 } }, { altPhone: { contains: l10 } }] },
    select: { id: true, name: true, phone: true },
  });
}

/** Heuristic fallback when no AI key is configured. */
function heuristicIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/\b(renewed|paid|done|paid it|payment done|renew(ed)? already)\b/.test(t)) return "renewed";
  if (/\b(policy copy|soft copy|send.*(policy|document)|my policy|copy of)\b/.test(t)) return "policy_copy";
  if (/\b(claim status|my claim|claim update|status of)\b/.test(t)) return "claim_status";
  if (/\b(later|busy|next week|call me|not now|some time|give me time)\b/.test(t)) return "needs_time";
  if (/\?|\b(how|what|when|why|which|can i|is it|does)\b/.test(t)) return "question";
  return "other";
}

async function classify(text: string): Promise<Intent> {
  if (!aiAvailable()) return heuristicIntent(text);
  try {
    const out = await complete({
      model: MODEL_FAST,
      system: PERSONA + " You are triaging an inbound WhatsApp message from an insurance client. Respond with ONLY a JSON object.",
      prompt: `Classify this client's message into exactly one intent.\nMessage: """${text}"""\nReturn JSON: {"intent": one of "renewed" | "needs_time" | "question" | "policy_copy" | "claim_status" | "other"}`,
      maxTokens: 60,
    });
    const j = extractJson<{ intent: Intent }>(out);
    return j?.intent ?? heuristicIntent(text);
  } catch {
    return heuristicIntent(text);
  }
}

async function addTask(clientId: string, title: string, type: string, priority: string, notes: string, dueInDays = 0) {
  const due = new Date();
  due.setDate(due.getDate() + dueInDays);
  await prisma.task.create({ data: { clientId, title, type, priority, dueDate: due, notes, status: "open" } });
}

/** Entry point called by the WhatsApp client on every inbound message. */
export async function handleInboundMessage(fromChatId: string, body: string): Promise<void> {
  try {
    const text = (body ?? "").trim();
    if (!text) return;
    const fromDigits = fromChatId.replace(/@c\.us$/, "");

    const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (!s || s.inboundMode === "off") return; // feature off

    const client = await findClient(fromDigits);
    if (!client) return; // unknown number — never engage (whitelist = known clients)

    // Always log the inbound message once triage/logging is enabled.
    await prisma.communication.create({
      data: { clientId: client.id, channel: "whatsapp", direction: "inbound", subject: "WhatsApp reply", body: text.slice(0, 2000), status: "received" },
    });

    if (s.inboundMode !== "triage") return; // "log" mode stops here

    const intent = await classify(text);
    const snippet = text.slice(0, 300);

    // ── self-service (item 15) — known numbers only, no vault data ──
    if (s.selfServiceMode !== "off" && (intent === "policy_copy" || intent === "claim_status")) {
      if (intent === "claim_status") {
        const claim = await prisma.claim.findFirst({ where: { clientId: client.id, status: { notIn: ["settled", "rejected"] } }, orderBy: { updatedAt: "desc" } });
        const reply = claim
          ? `Hi ${client.name}, here's your claim status: your claim${claim.claimNumber ? ` ${claim.claimNumber}` : ""} is currently *${claim.status}*. I'm tracking it and will update you as it moves. — Vignesh`
          : `Hi ${client.name}, I don't see an open claim on your account right now. If you'd like to start one, just tell me what happened and I'll help. — Vignesh`;
        if (s.selfServiceMode === "auto") await waSend(client.phone, reply);
        else await queueSelfService(client.id, client.phone, `Claim-status reply · ${client.name}`, reply);
      } else {
        // policy_copy: never auto-blast a document; flag for the agent to send.
        await addTask(client.id, `Send policy copy to ${client.name} (requested on WhatsApp)`, "follow_up", "high", snippet);
        if (s.selfServiceMode === "auto") await waSend(client.phone, `Sure ${client.name}, I'll share your policy copy shortly. — Vignesh`);
      }
      return;
    }

    // ── triage (item 14) ──
    switch (intent) {
      case "renewed":
        await addTask(client.id, `Verify & mark renewal — ${client.name} says renewed`, "renewal", "high", snippet);
        break;
      case "needs_time":
        await addTask(client.id, `Follow up with ${client.name} (asked for time)`, "follow_up", "medium", snippet, 3);
        break;
      case "question":
        await addTask(client.id, `Reply to ${client.name}'s question`, "follow_up", "high", snippet);
        break;
      default:
        await addTask(client.id, `Review ${client.name}'s WhatsApp reply`, "other", "low", snippet);
    }
  } catch (e) {
    console.error("[inbound] handling failed:", e instanceof Error ? e.message : e);
  }
}

async function queueSelfService(clientId: string, phone: string, title: string, message: string) {
  const dedupeRef = `selfservice:${clientId}:${Date.now()}`;
  await prisma.outbox.create({ data: { category: "selfservice", clientId, phone, title, message, dedupeRef, status: "pending" } });
}
