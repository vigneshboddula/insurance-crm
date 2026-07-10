import "server-only";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { DATA_DIR } from "@/lib/paths";
import { ingestOne, loadCandidates } from "@/lib/ingest-core";

// ──────────────────────────────────────────────────────────────
// Phase 3 · item 16 — document auto-intake from a watched folder.
//
// The agent (or the IMAP poller, lib/imap.ts) drops policy PDFs / renewal
// notices into an inbox folder; each engine tick this scans it, runs every new
// PDF through the SAME extract → match → auto-file pipeline as the manual
// bulk import, then moves the source file into a `processed/` subfolder. Files
// that can't be matched still land in the review queue (nothing is lost).
// Off by default; fully local.
// ──────────────────────────────────────────────────────────────

/** The inbox folder to watch (setting, else DATA_DIR/inbox). Created on demand. */
export async function watchedFolderDir(): Promise<string> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { watchedFolderPath: true } });
  const dir = s?.watchedFolderPath?.trim() || path.join(DATA_DIR, "inbox");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function scanWatchedFolder(): Promise<{ attached: number; review: number; unmatched: number; errors: number; total: number; skipped?: string }> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" }, select: { watchedFolderEnabled: true } });
  const empty = { attached: 0, review: 0, unmatched: 0, errors: 0, total: 0 };
  if (!s?.watchedFolderEnabled) return { ...empty, skipped: "disabled" };

  try {
    const dir = await watchedFolderDir();
    const processed = path.join(dir, "processed");
    await fs.mkdir(processed, { recursive: true });

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const pdfs = entries.filter((e) => e.isFile() && /\.pdf$/i.test(e.name)).map((e) => e.name);
    if (!pdfs.length) return { ...empty, skipped: "empty" };

    const candidates = await loadCandidates();
    const out = { ...empty, total: pdfs.length };
    for (const name of pdfs) {
      const src = path.join(dir, name);
      try {
        const buf = await fs.readFile(src);
        const r = await ingestOne(name, buf, "auto", candidates);
        if (r === "attached") out.attached++;
        else if (r === "review") out.review++;
        else if (r === "unmatched") out.unmatched++;
        else out.errors++;
      } catch {
        out.errors++;
      }
      // move the source out of the way so it isn't re-ingested next tick
      try { await fs.rename(src, path.join(processed, stamped(name))); } catch { /* leave it; de-dupe guard covers a re-scan */ }
    }
    if (out.attached || out.review || out.unmatched) console.log(`[intake] folder: ${out.attached} filed, ${out.review} review, ${out.unmatched} unmatched`);
    return out;
  } catch (e) {
    console.error("[intake] folder scan failed:", e instanceof Error ? e.message : e);
    return { ...empty, skipped: "error" };
  }
}

function stamped(name: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${ts}__${name}`;
}
