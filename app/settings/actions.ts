"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}
function int(fd: FormData, key: string, fallback: number): number {
  const n = Number(fd.get(key));
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

export async function updateSettings(fd: FormData) {
  const data = {
    birthdayMemberOffsetDays: int(fd, "birthdayMemberOffsetDays", 1),
    renewalLeadDays: int(fd, "renewalLeadDays", 15),
    myLinkedin: str(fd, "myLinkedin"),
    myInstagram: str(fd, "myInstagram"),
    myYoutube: str(fd, "myYoutube"),
  };
  await prisma.appSettings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  revalidatePath("/settings");
  revalidatePath("/");
}

/** Phase 3 · automation engine settings (item 12). */
export async function updateEngineSettings(fd: FormData) {
  const enabled = fd.get("engineEnabled") === "on";
  let hour = int(fd, "digestHour", 8);
  if (hour > 23) hour = 23;
  const data = {
    engineEnabled: enabled,
    agentWhatsApp: str(fd, "agentWhatsApp"),
    digestHour: hour,
  };
  await prisma.appSettings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  revalidatePath("/settings");
}

/** Send the daily digest right now to the agent's own WhatsApp (test button). */
export async function sendTestDigest(): Promise<{ ok: boolean; error?: string; preview: string }> {
  const { sendDigestNow } = await import("@/lib/engine");
  return sendDigestNow();
}

/** Phase 3 · items 14–18 automation settings. */
export async function updateAutomationsSettings(fd: FormData) {
  const mode = (key: string, allowed: string[], fallback = "off") => {
    const v = String(fd.get(key) ?? fallback);
    return allowed.includes(v) ? v : fallback;
  };
  const data: Record<string, unknown> = {
    inboundMode: mode("inboundMode", ["off", "log", "triage"]),
    selfServiceMode: mode("selfServiceMode", ["off", "approve", "auto"]),
    quoteSendMode: mode("quoteSendMode", ["off", "approve", "auto"]),
    winbackMode: mode("winbackMode", ["off", "approve", "auto"]),
    claimSeqMode: mode("claimSeqMode", ["off", "approve", "auto"]),
    delightMode: mode("delightMode", ["off", "approve", "auto"]),
    watchedFolderEnabled: fd.get("watchedFolderEnabled") === "on",
    watchedFolderPath: str(fd, "watchedFolderPath"),
    imapEnabled: fd.get("imapEnabled") === "on",
    imapHost: str(fd, "imapHost"),
    imapPort: int(fd, "imapPort", 993),
    imapUser: str(fd, "imapUser"),
  };
  // Only re-encrypt the mailbox password when a new one is typed (blank = keep).
  const pass = str(fd, "imapPass");
  if (pass) {
    const { encrypt } = await import("@/lib/crypto");
    data.imapPassEnc = encrypt(pass);
  }
  await prisma.appSettings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  revalidatePath("/settings");
}

/** Phase 3 · auto-send cadence settings (item 13). */
export async function updateAutoSendSettings(fd: FormData) {
  const mode = String(fd.get("renewalSendMode") ?? "approve");
  const clampHour = (n: number) => Math.min(23, Math.max(0, n));
  const data = {
    renewalSendMode: ["approve", "auto", "off"].includes(mode) ? mode : "approve",
    autoSendDailyCap: Math.min(500, Math.max(1, int(fd, "autoSendDailyCap", 40))),
    quietStart: clampHour(int(fd, "quietStart", 21)),
    quietEnd: clampHour(int(fd, "quietEnd", 9)),
  };
  await prisma.appSettings.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
  revalidatePath("/settings");
}

/** Full demo reset — wipes EVERY data table (clients, policies, documents,
 *  renewals, tasks, leads, claims, communications, everything). A restorable
 *  snapshot is written first. Configuration (settings, templates) is kept. */
export async function clearAllDemoData(): Promise<{ cleared: number; note: string }> {
  const { clearAllData } = await import("@/lib/demo-reset");
  const { cleared } = await clearAllData();
  revalidatePaths();
  return { cleared, note: `Cleared everything — ${cleared} records across all sections. Every screen is now empty. Use Restore to bring it all back.` };
}

/** Restore everything from the last "Clear all data" snapshot. */
export async function restoreDemoData(): Promise<{ restored: number; note: string }> {
  const { restoreLastClear } = await import("@/lib/demo-reset");
  const { restored, hadBackup } = await restoreLastClear();
  revalidatePaths();
  return { restored, note: hadBackup ? `Restored ${restored} records.` : "Nothing to restore — no previous clear found." };
}

function revalidatePaths() {
  for (const p of ["/", "/clients", "/policies", "/renewals", "/collections", "/leads", "/claims", "/tasks", "/communications", "/reports", "/settings"]) revalidatePath(p);
}
