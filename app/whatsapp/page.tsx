import { prisma } from "@/lib/db";
import { WhatsAppPanel } from "@/components/whatsapp/WhatsAppPanel";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const templates = await prisma.messageTemplate.findMany({ orderBy: [{ category: "asc" }, { language: "asc" }] });
  return <WhatsAppPanel templates={templates.map((t) => ({ id: t.id, name: t.name, category: t.category, language: t.language, body: t.body }))} />;
}
