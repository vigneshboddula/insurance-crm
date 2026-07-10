import "server-only";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { watchedFolderDir } from "@/lib/intake";

// ──────────────────────────────────────────────────────────────
// Phase 3 · item 16 — document auto-intake from a local mailbox (IMAP).
//
// Fully OFF by default and private: connects only to the agent's own mailbox,
// on their own credentials (password stored encrypted). Each poll pulls UNSEEN
// messages, saves any PDF attachments into the watched-inbox folder, and marks
// them seen — the watched-folder scan (lib/intake.ts) then extracts + files
// them through the same pipeline as a manual upload. Never throws out; a bad
// config or unreachable server just logs and no-ops until the next tick.
// ──────────────────────────────────────────────────────────────

// Minimal shape of the bits of imapflow's ImapFlow we use (kept local so the
// build never depends on imapflow's own types — it's resolved at runtime).
type ImapMsg = { uid: number; bodyStructure: unknown };
interface ImapClient {
  connect(): Promise<void>;
  getMailboxLock(name: string): Promise<{ release(): void }>;
  fetch(query: unknown, opts: unknown): AsyncIterable<ImapMsg>;
  download(uid: string, part: string, opts: unknown): Promise<{ content: AsyncIterable<Buffer> }>;
  messageFlagsAdd(uid: string, flags: string[], opts: unknown): Promise<unknown>;
  logout(): Promise<void>;
}

let lastPollAt = 0;
const MIN_GAP_MS = 10 * 60_000; // don't hammer the mailbox — at most every 10 min

export async function imapPoll(): Promise<{ saved: number; skipped?: string }> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!s?.imapEnabled) return { saved: 0, skipped: "disabled" };
  if (!s.imapHost || !s.imapUser || !s.imapPassEnc) return { saved: 0, skipped: "not configured" };
  if (Date.now() - lastPollAt < MIN_GAP_MS) return { saved: 0, skipped: "throttled" };
  lastPollAt = Date.now();

  let pass: string;
  try {
    const dec = decrypt(s.imapPassEnc);
    if (!dec) return { saved: 0, skipped: "bad password" };
    pass = dec;
  } catch { return { saved: 0, skipped: "bad password" }; }

  const inbox = await watchedFolderDir();
  let saved = 0;
  try {
    // imapflow is an OPTIONAL runtime dependency (install once to enable IMAP:
    // `npm install imapflow`). Loaded via a webpackIgnore'd non-literal specifier
    // so the bundler never touches it and a missing package just no-ops.
    const modName = "imapflow";
    const mod = (await import(/* webpackIgnore: true */ modName)) as unknown as { ImapFlow: new (opts: unknown) => ImapClient };
    const client = new mod.ImapFlow({
      host: s.imapHost,
      port: s.imapPort || 993,
      secure: true,
      auth: { user: s.imapUser, pass },
      logger: false,
    });
    await client.connect();
    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        // Unseen messages only. bodyStructure lets us find PDF parts.
        for await (const msg of client.fetch({ seen: false }, { source: false, bodyStructure: true, uid: true })) {
          const parts = collectPdfParts(msg.bodyStructure);
          for (const part of parts) {
            const { content } = await client.download(String(msg.uid), part.part, { uid: true });
            const chunks: Buffer[] = [];
            for await (const c of content) chunks.push(c as Buffer);
            const buf = Buffer.concat(chunks);
            if (!buf.length) continue;
            const name = safeName(part.filename || `mail-${msg.uid}-${part.part}.pdf`);
            await fs.writeFile(path.join(inbox, name), buf);
            saved++;
          }
          await client.messageFlagsAdd(String(msg.uid), ["\\Seen"], { uid: true });
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  } catch (e) {
    console.error("[imap] poll failed:", e instanceof Error ? e.message : e);
    return { saved, skipped: "error" };
  }
  if (saved) console.log(`[imap] saved ${saved} attachment(s) to the inbox folder`);
  return { saved };
}

type PdfPart = { part: string; filename?: string };

// Walk the MIME tree for application/pdf (or .pdf-named) attachment parts.
function collectPdfParts(node: unknown, acc: PdfPart[] = []): PdfPart[] {
  if (!node || typeof node !== "object") return acc;
  const n = node as { type?: string; subtype?: string; part?: string; parameters?: Record<string, string>; dispositionParameters?: Record<string, string>; childNodes?: unknown[] };
  const fname = n.dispositionParameters?.filename || n.parameters?.name;
  const isPdf = (n.type === "application" && n.subtype === "pdf") || (fname ? /\.pdf$/i.test(fname) : false);
  if (isPdf && n.part) acc.push({ part: n.part, filename: fname });
  if (Array.isArray(n.childNodes)) for (const c of n.childNodes) collectPdfParts(c, acc);
  return acc;
}

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}
