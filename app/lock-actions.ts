"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { tryUnlock } from "@/lib/lock";

export async function unlockApp(_prev: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const pass = String(fd.get("passcode") ?? "");
  if (!pass) return { error: "Enter your passcode." };
  const ok = await tryUnlock(pass);
  if (!ok) return { error: "Wrong passcode — try again." };
  revalidatePath("/", "layout");
  return {};
}

/** Set, change, or remove the app passcode (from Settings). */
export async function setAppPasscode(fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "").trim();

  const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (s?.appPasscode && decrypt(s.appPasscode) !== current) {
    return { error: "Current passcode is wrong." };
  }
  if (next && next.length < 4) return { error: "Passcode must be at least 4 characters." };

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", appPasscode: next ? encrypt(next) : null },
    update: { appPasscode: next ? encrypt(next) : null },
  });
  await prisma.auditLog.create({ data: { event: "passcode_set", detail: next ? "passcode enabled/changed" : "passcode removed" } });
  if (next) await tryUnlock(next); // stay unlocked after setting
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}
