import "server-only";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { readDecryptedFile } from "@/lib/storage";
import { decrypt, maskId } from "@/lib/crypto";
import { labelOf, LINES } from "@/lib/enums";

import { DB_PATH, STORAGE_DIR as STORAGE, DATA_DIR } from "@/lib/paths";

const MAGIC = "CRMBK1";

function keyFromPass(pass: string, salt: Buffer) {
  return crypto.scryptSync(pass, salt, 32);
}

/** Build an encrypted backup: the SQLite DB + all stored (already-encrypted) documents,
 *  bundled into one blob and encrypted again with a passphrase only the user knows. */
export async function createEncryptedBackup(passphrase: string): Promise<Buffer> {
  if (!passphrase || passphrase.length < 6) throw new Error("Passphrase must be at least 6 characters.");

  const db = await fs.readFile(DB_PATH);
  let docs: { name: string; data: string }[] = [];
  try {
    const files = await fs.readdir(STORAGE);
    docs = await Promise.all(files.map(async (f) => ({ name: f, data: (await fs.readFile(path.join(STORAGE, f))).toString("base64") })));
  } catch {
    /* no storage dir yet */
  }

  const container = JSON.stringify({ version: 1, createdAt: new Date().toISOString(), db: db.toString("base64"), documents: docs });
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFromPass(passphrase, salt), iv);
  const enc = Buffer.concat([cipher.update(container, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from(MAGIC), salt, iv, tag, enc]);
}

/** Decrypt a backup and restore documents + the DB into a safe `restore/` folder
 *  (never overwrites the live DB while the app is running). */
export async function restoreEncryptedBackup(blob: Buffer, passphrase: string): Promise<{ documents: number }> {
  if (blob.subarray(0, MAGIC.length).toString() !== MAGIC) throw new Error("Not a valid CRM backup file.");
  let off = MAGIC.length;
  const salt = blob.subarray(off, (off += 16));
  const iv = blob.subarray(off, (off += 12));
  const tag = blob.subarray(off, (off += 16));
  const data = blob.subarray(off);
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyFromPass(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  let json: string;
  try {
    json = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Wrong passphrase or corrupted backup.");
  }
  const parsed = JSON.parse(json) as { db: string; documents: { name: string; data: string }[] };

  const outDir = path.join(DATA_DIR, "restore");
  const outStorage = path.join(outDir, "storage");
  await fs.mkdir(outStorage, { recursive: true });
  await fs.writeFile(path.join(outDir, "dev.db"), Buffer.from(parsed.db, "base64"));
  for (const d of parsed.documents) await fs.writeFile(path.join(outStorage, d.name), Buffer.from(d.data, "base64"));
  return { documents: parsed.documents.length };
}

/** Plaintext export ZIP for the user's own use: Excel of clients/policies + the documents. */
export async function buildExportZip(): Promise<Buffer> {
  const [clients, policies] = await Promise.all([
    prisma.client.findMany({ where: { archivedAt: null }, include: { vault: true, household: true } }),
    prisma.policy.findMany({ where: { client: { archivedAt: null } }, include: { client: { select: { name: true } } } }),
  ]);

  const clientRows = [
    ["Name", "Phone", "Alt phone", "Email", "DOB", "Household", "Aadhaar (masked)", "PAN (masked)", "Tags"],
    ...clients.map((c) => [
      c.name, c.phone, c.altPhone ?? "", c.email ?? "", c.dob ? c.dob.toISOString().slice(0, 10) : "",
      c.household?.name ?? "", maskId(decrypt(c.vault?.aadhaarEnc)), maskId(decrypt(c.vault?.panEnc)), c.tags ?? "",
    ]),
  ];
  const policyRows = [
    ["Client", "Insurer", "Line", "Policy number", "Variant", "Sum insured", "Premium", "Due date", "Status"],
    ...policies.map((p) => [
      p.client.name, p.carrier, labelOf(LINES, p.line), p.policyNumber, p.variant ?? "",
      p.sumAssured, p.premium, p.renewalDate.toISOString().slice(0, 10), p.status,
    ]),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(clientRows), "Clients");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(policyRows), "Policies");
  const xlsxBuf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const zip = new JSZip();
  zip.file("crm-data.xlsx", xlsxBuf);

  const docs = await prisma.document.findMany({ include: { client: { select: { name: true } } } });
  const folder = zip.folder("documents")!;
  for (const d of docs) {
    try {
      const bytes = await readDecryptedFile(d.storagePath);
      const safe = `${d.client.name.replace(/[^a-z0-9]+/gi, "_")}/${d.fileName}`;
      folder.file(safe, bytes);
    } catch {
      /* skip unreadable */
    }
  }
  return zip.generateAsync({ type: "nodebuffer" }) as unknown as Promise<Buffer>;
}
