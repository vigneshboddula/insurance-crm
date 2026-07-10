import "server-only";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { SNAPSHOT_DIR } from "@/lib/paths";

// Daily local safety net: a consistent copy of the SQLite DB (via VACUUM INTO,
// safe under WAL) into DATA_DIR/snapshots, at most once per calendar day,
// keeping the newest 14. Runs on server start (instrumentation.ts); the
// Phase-3 background engine will take over scheduling later. This complements
// (not replaces) the encrypted off-machine backup in Settings.

const KEEP = 14;

export async function maybeSnapshot(): Promise<void> {
  try {
    await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
    const today = new Date().toISOString().slice(0, 10);
    const target = path.join(SNAPSHOT_DIR, `dev-${today}.db`);
    try {
      await fs.access(target);
      return; // today's snapshot already exists
    } catch { /* not yet — take one */ }

    // VACUUM INTO writes a compact, consistent copy; path needs forward slashes
    await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/\\/g, "/").replace(/'/g, "''")}'`);

    // prune to the newest KEEP snapshots
    const files = (await fs.readdir(SNAPSHOT_DIR)).filter((f) => /^dev-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - KEEP))) {
      await fs.unlink(path.join(SNAPSHOT_DIR, f)).catch(() => {});
    }
    console.log(`[snapshots] daily DB snapshot written: ${target}`);
  } catch (e) {
    console.error("[snapshots] failed:", e instanceof Error ? e.message : e);
  }
}
