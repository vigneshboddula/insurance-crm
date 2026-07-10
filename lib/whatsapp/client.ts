import "server-only";
import fs from "fs";
import path from "path";
import pkg from "whatsapp-web.js";
import QRCode from "qrcode";
import puppeteer from "puppeteer";
import { DATA_DIR } from "@/lib/paths";

// The WhatsApp linked-session store lives OUTSIDE OneDrive (in DATA_DIR, next to
// the DB) — OneDrive syncing/locking these files corrupted the session and threw
// repeated auth_failure. Same rule as the DB, storage, and build dirs.
const WA_SESSION_DIR = path.join(DATA_DIR, "wwebjs_auth");

const { Client, LocalAuth, MessageMedia } = pkg;

type Status = "disconnected" | "initializing" | "qr" | "ready" | "auth_failure";
type WaGlobal = {
  client: InstanceType<typeof Client> | null;
  status: Status;
  qr: string | null; // data URL
  me: string | null; // connected number
  lastSentAt: number;
  lastAutoAt: number; // last auto-reconnect attempt
};

// survive Next.js dev hot-reload (module re-eval) by stashing on globalThis
const g = globalThis as unknown as { __wa?: WaGlobal };
function store(): WaGlobal {
  if (!g.__wa) g.__wa = { client: null, status: "disconnected", qr: null, me: null, lastSentAt: 0, lastAutoAt: 0 };
  return g.__wa;
}

export function waState() {
  const s = store();
  return { status: s.status, qr: s.qr, me: s.me };
}

/** True if a previous WhatsApp login is saved on disk (LocalAuth session). */
function hasSavedSession(): boolean {
  try {
    const dir = WA_SESSION_DIR;
    return fs.existsSync(dir) && fs.readdirSync(dir).some((n) => n.startsWith("session"));
  } catch {
    return false;
  }
}

/**
 * Silently reconnect from a saved session when disconnected — so the agent
 * never has to click "Connect" after restarting the app. Throttled to one
 * attempt per 30s; no-op when there's no saved session (first-time link still
 * needs the QR). Returns the (possibly updated) state.
 */
export async function waAutoConnect() {
  const s = store();
  if (s.client || s.status !== "disconnected") return waState();
  if (Date.now() - s.lastAutoAt < 30_000) return waState();
  if (!hasSavedSession()) return waState();
  s.lastAutoAt = Date.now();
  return waConnect();
}

/** Start (or reuse) the linked-WhatsApp session. Emits a QR until scanned. */
export async function waConnect() {
  const s = store();
  if (s.client && (s.status === "ready" || s.status === "qr" || s.status === "initializing")) return waState();
  s.status = "initializing";
  s.qr = null;

  let exec: string | undefined;
  try { exec = puppeteer.executablePath(); } catch { exec = undefined; }

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: WA_SESSION_DIR }),
    puppeteer: { headless: true, executablePath: exec, args: ["--no-sandbox", "--disable-setuid-sandbox"] },
  });
  s.client = client;

  client.on("qr", async (qr: string) => { s.qr = await QRCode.toDataURL(qr); s.status = "qr"; });
  client.on("authenticated", () => { s.qr = null; });
  client.on("ready", () => { s.status = "ready"; s.qr = null; s.me = client.info?.wid?.user ?? null; });
  client.on("auth_failure", () => { s.status = "auth_failure"; });
  client.on("disconnected", () => { s.status = "disconnected"; s.client = null; s.me = null; });

  // Phase 3 · item 14 — two-way inbound. Only 1:1 chats (not groups/status);
  // triage itself is gated by settings inside handleInboundMessage (OFF by default).
  client.on("message", async (msg: { from?: string; body?: string; fromMe?: boolean }) => {
    try {
      if (msg.fromMe) return;
      const from = msg.from ?? "";
      if (!from.endsWith("@c.us")) return; // ignore groups (@g.us) / status broadcast
      const { handleInboundMessage } = await import("@/lib/inbound");
      await handleInboundMessage(from, msg.body ?? "");
    } catch { /* never let an inbound handler crash the client */ }
  });

  client.initialize().catch(() => { s.status = "auth_failure"; });
  return waState();
}

export async function waLogout() {
  const s = store();
  try { await s.client?.logout(); await s.client?.destroy(); } catch { /* ignore */ }
  s.client = null; s.status = "disconnected"; s.qr = null; s.me = null;
}

/** Normalize a phone to a WhatsApp chat id, defaulting to India (+91). */
function toChatId(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  return d + "@c.us";
}

/** Send a message (optionally with a document), with throttling safeguards. */
export async function waSend(phone: string, text: string, media?: { mime: string; base64: string; filename: string }): Promise<{ ok: boolean; error?: string }> {
  const s = store();
  if (!s.client || s.status !== "ready") return { ok: false, error: "WhatsApp isn't connected — scan the QR first." };

  // safeguard: space out sends + small randomized human-like delay
  const gap = Date.now() - s.lastSentAt;
  if (gap < 3000) await new Promise((r) => setTimeout(r, 3000 - gap));
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 1500));

  try {
    const chatId = toChatId(phone);
    if (media) {
      const m = new MessageMedia(media.mime, media.base64, media.filename);
      await s.client.sendMessage(chatId, m, { caption: text || undefined });
    } else {
      await s.client.sendMessage(chatId, text);
    }
    s.lastSentAt = Date.now();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
