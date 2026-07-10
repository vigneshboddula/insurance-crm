import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { readDecryptedFile } from "@/lib/storage";

// Streams a stored document back, decrypting it on the fly. Local-only app,
// single user — the file never exists in plaintext on disk.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });

  try {
    const bytes = await readDecryptedFile(doc.storagePath);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Unable to read file", { status: 500 });
  }
}
