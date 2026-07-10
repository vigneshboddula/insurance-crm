import "server-only";
import os from "os";
import path from "path";

// ──────────────────────────────────────────────────────────────
// Central data locations. The live database and encrypted documents live
// OUTSIDE the (OneDrive-synced) project folder so cloud sync can never
// revert or corrupt them. Override with CRM_DATA_DIR in .env if needed.
// The project folder keeps only code; DATABASE_URL in .env must point at
// the same DATA_DIR (checked by `npm run setup` docs).
// ──────────────────────────────────────────────────────────────

export const DATA_DIR = process.env.CRM_DATA_DIR?.trim() || path.join(os.homedir(), "insurance-crm-data");

/** Encrypted document blobs. */
export const STORAGE_DIR = path.join(DATA_DIR, "storage");

/** Daily consistent DB snapshots (see lib/snapshots.ts). */
export const SNAPSHOT_DIR = path.join(DATA_DIR, "snapshots");

/** The live SQLite file (informational — Prisma reads DATABASE_URL itself). */
export const DB_PATH = path.join(DATA_DIR, "dev.db");
