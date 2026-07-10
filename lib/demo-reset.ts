import "server-only";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { DATA_DIR } from "@/lib/paths";

// ──────────────────────────────────────────────────────────────
// Demo / testing full reset. "Clear all data" wipes EVERY data table (like a
// factory reset — clients, policies, documents, renewals, tasks, leads, claims,
// communications, everything) so every screen reads empty. It is reversible:
// a JSON snapshot of all rows is written to disk first, and "Restore" reloads
// it. Encrypted document blobs on disk are kept (restore re-links them), and
// app configuration (AppSettings, Agent, saved MessageTemplates) is NOT touched.
// ──────────────────────────────────────────────────────────────

const BACKUP_PATH = path.join(DATA_DIR, "demo-reset-backup.json");

// Data tables in dependency order (parents first). Insert in this order;
// delete in reverse so foreign keys are always satisfied. AppSettings / Agent /
// MessageTemplate are intentionally omitted — they're configuration, not data.
const TABLES = [
  "household", "client", "clientVault", "lead", "policy", "policyVersion",
  "document", "policyInsured", "renewal", "renewalReminder", "claim",
  "endorsement", "collection", "task", "importMatch", "ingestDoc", "outbox",
  "autoSend", "auditLog", "communication", "commission", "aIInsight",
] as const;

// Revive ISO date strings (from JSON) back into Date objects so Prisma accepts
// them. cuids / policy numbers / plain strings don't match this exact shape.
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
function reviveDates<T extends Record<string, unknown>>(row: T): T {
  for (const k of Object.keys(row)) {
    const v = row[k];
    if (typeof v === "string" && ISO_RE.test(v)) (row as Record<string, unknown>)[k] = new Date(v);
  }
  return row;
}

/** Wipe all data tables. Writes a restorable snapshot first. Returns rows cleared. */
export async function clearAllData(): Promise<{ cleared: number }> {
  // 1. snapshot everything (so Restore can bring it all back)
  const dump: Record<string, unknown[]> = {};
  let cleared = 0;
  for (const t of TABLES) {
    const rows = await (prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[t].findMany();
    dump[t] = rows;
    cleared += rows.length;
  }
  writeFileSync(BACKUP_PATH, JSON.stringify(dump), "utf8");

  // 2. delete children-first (reverse dependency order)
  await prisma.$transaction(
    async (tx) => {
      for (const t of [...TABLES].reverse()) {
        await (tx as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[t].deleteMany();
      }
    },
    { timeout: 60_000 },
  );

  return { cleared };
}

/** Reload everything from the last snapshot written by clearAllData(). */
export async function restoreLastClear(): Promise<{ restored: number; hadBackup: boolean }> {
  if (!existsSync(BACKUP_PATH)) return { restored: 0, hadBackup: false };
  const dump = JSON.parse(readFileSync(BACKUP_PATH, "utf8")) as Record<string, Record<string, unknown>[]>;

  let restored = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const t of TABLES) {
        const rows = (dump[t] ?? []).map(reviveDates);
        if (!rows.length) continue;
        await (tx as unknown as Record<string, { createMany: (a: { data: unknown[] }) => Promise<unknown> }>)[t].createMany({ data: rows });
        restored += rows.length;
      }
    },
    { timeout: 60_000 },
  );

  return { restored, hadBackup: true };
}

/** Whether a restorable snapshot exists (for showing/enabling the Restore button). */
export function hasClearBackup(): boolean {
  return existsSync(BACKUP_PATH);
}
