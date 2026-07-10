import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { decrypt, hmacSign } from "@/lib/crypto";

// App lock: optional passcode (stored encrypted in AppSettings.appPasscode).
// Unlocking sets an httpOnly cookie holding an HMAC derived from the server
// key + the passcode ciphertext; it expires after IDLE_MINUTES, giving
// auto-lock on idle. Pages are gated in the root layout; API routes stay open
// (they only serve the app itself on localhost).

export const IDLE_MINUTES = 30;
const COOKIE = "crm_unlock";

function token(passcodeEnc: string): string {
  return hmacSign("unlock:" + passcodeEnc);
}

/** Current lock state: "none" (no passcode set) | "locked" | "unlocked". */
export async function lockState(): Promise<"none" | "locked" | "unlocked"> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!s?.appPasscode) return "none";
  const jar = await cookies();
  const c = jar.get(COOKIE)?.value;
  return c === token(s.appPasscode) ? "unlocked" : "locked";
}

/** Verify a passcode attempt; on success set the unlock cookie. */
export async function tryUnlock(passcode: string): Promise<boolean> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!s?.appPasscode) return true;
  const ok = decrypt(s.appPasscode) === passcode;
  await prisma.auditLog.create({ data: { event: ok ? "unlock" : "unlock_failed" } });
  if (ok) {
    const jar = await cookies();
    jar.set(COOKIE, token(s.appPasscode), { httpOnly: true, sameSite: "lax", maxAge: IDLE_MINUTES * 60, path: "/" });
  }
  return ok;
}

/** Refresh the idle timer (called from the layout on each page load while unlocked). */
export async function touchUnlock(): Promise<void> {
  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!s?.appPasscode) return;
  const jar = await cookies();
  if (jar.get(COOKIE)?.value === token(s.appPasscode)) {
    jar.set(COOKIE, token(s.appPasscode), { httpOnly: true, sameSite: "lax", maxAge: IDLE_MINUTES * 60, path: "/" });
  }
}
