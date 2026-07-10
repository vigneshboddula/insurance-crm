import "server-only";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { encryptBuffer, decryptBuffer } from "@/lib/crypto";
import { STORAGE_DIR } from "@/lib/paths";

// Encrypted document storage. Files are written as AES-256-GCM blobs under
// DATA_DIR/storage (outside the synced project folder) — never as plaintext.
// The DB only keeps the file name.

async function ensureDir() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

/** Encrypt and persist a file's bytes. Returns the relative storage path. */
export async function saveEncryptedFile(bytes: Buffer): Promise<string> {
  await ensureDir();
  const name = `${crypto.randomUUID()}.enc`;
  const enc = encryptBuffer(bytes);
  await fs.writeFile(path.join(STORAGE_DIR, name), enc);
  return name;
}

/** Read and decrypt a stored file back to plaintext bytes. */
export async function readDecryptedFile(storagePath: string): Promise<Buffer> {
  const blob = await fs.readFile(path.join(STORAGE_DIR, path.basename(storagePath)));
  return decryptBuffer(blob);
}

export async function deleteStoredFile(storagePath: string): Promise<void> {
  try {
    await fs.unlink(path.join(STORAGE_DIR, path.basename(storagePath)));
  } catch {
    /* already gone */
  }
}
