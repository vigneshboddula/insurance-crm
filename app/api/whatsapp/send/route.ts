import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { waSend } from "@/lib/whatsapp/client";
import { readDecryptedFile } from "@/lib/storage";

export async function POST(req: NextRequest) {
  const { phone, text, documentId, clientId, subject } = await req.json();
  if (!phone || (!text && !documentId)) return Response.json({ ok: false, error: "Phone and a message or document are required" }, { status: 400 });

  let media: { mime: string; base64: string; filename: string } | undefined;
  if (documentId) {
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (doc) {
      try {
        const bytes = await readDecryptedFile(doc.storagePath);
        media = { mime: doc.mimeType, base64: bytes.toString("base64"), filename: doc.fileName };
      } catch { /* skip unreadable attachment */ }
    }
  }

  const res = await waSend(phone, text ?? "", media);

  // auto-log to the holder's communication history
  if (clientId) {
    await prisma.communication.create({
      data: {
        clientId, channel: "whatsapp", direction: "outbound",
        subject: subject ?? (media ? "Document sent" : "Message"), body: text ?? (media ? media.filename : ""),
        status: res.ok ? "sent" : "failed",
      },
    });
    revalidatePath(`/clients/${clientId}`);
  }
  return Response.json(res);
}
