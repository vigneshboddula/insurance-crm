import { NextRequest } from "next/server";
import { restoreEncryptedBackup } from "@/lib/backup";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const passphrase = String(form.get("passphrase") ?? "");
  if (!(file instanceof File) || file.size === 0) return Response.redirect(new URL("/settings?restore_error=Choose+a+backup+file", req.url));
  try {
    const r = await restoreEncryptedBackup(Buffer.from(await file.arrayBuffer()), passphrase);
    return Response.redirect(new URL(`/settings?restored=${r.documents}`, req.url));
  } catch (e) {
    return Response.redirect(new URL(`/settings?restore_error=${encodeURIComponent(e instanceof Error ? e.message : "Restore failed")}`, req.url));
  }
}
