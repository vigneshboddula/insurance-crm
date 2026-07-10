import { NextRequest } from "next/server";
import { createEncryptedBackup } from "@/lib/backup";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const passphrase = String(form.get("passphrase") ?? "");
  try {
    const buf = await createEncryptedBackup(passphrase);
    await prisma.appSettings.upsert({ where: { id: "singleton" }, update: { lastBackupAt: new Date() }, create: { id: "singleton", lastBackupAt: new Date() } });
    const name = `crm-backup-${new Date().toISOString().slice(0, 10)}.crmbackup`;
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Backup failed", { status: 400 });
  }
}
