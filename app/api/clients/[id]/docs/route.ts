import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lists a holder's attachable documents (newest first) so the WhatsApp draft
// dialog can offer to send a policy copy / renewal notice alongside the message.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docs = await prisma.document.findMany({
    where: { clientId: id },
    select: { id: true, fileName: true, type: true, label: true },
    orderBy: { uploadedAt: "desc" },
  });
  return Response.json({ docs });
}
