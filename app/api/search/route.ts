import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Result = { type: "client" | "policy" | "lead"; id: string; name: string; sub: string; href: string };

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return Response.json({ results: [] });

  // SQLite LIKE (Prisma `contains`) is case-insensitive for ASCII.
  const [clients, policies, leads] = await Promise.all([
    prisma.client.findMany({
      where: { archivedAt: null, OR: [{ name: { contains: q } }, { phone: { contains: q } }] },
      select: { id: true, name: true, phone: true },
      take: 6,
      orderBy: { name: "asc" },
    }),
    prisma.policy.findMany({
      where: { client: { archivedAt: null }, OR: [{ policyNumber: { contains: q } }, { carrier: { contains: q } }] },
      select: { id: true, clientId: true, policyNumber: true, carrier: true, line: true, client: { select: { name: true } } },
      take: 6,
      orderBy: { renewalDate: "asc" },
    }),
    prisma.lead.findMany({
      where: { OR: [{ name: { contains: q } }, { phone: { contains: q } }] },
      select: { id: true, name: true, phone: true, stage: true },
      take: 4,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const results: Result[] = [
    ...clients.map((c) => ({ type: "client" as const, id: c.id, name: c.name, sub: c.phone ?? "", href: `/clients/${c.id}` })),
    ...policies.map((p) => ({ type: "policy" as const, id: p.id, name: p.client.name, sub: `${p.carrier} · ${p.line} · ${p.policyNumber}`, href: `/clients/${p.clientId}` })),
    ...leads.map((l) => ({ type: "lead" as const, id: l.id, name: l.name, sub: `${l.stage}${l.phone ? ` · ${l.phone}` : ""}`, href: `/leads` })),
  ];

  return Response.json({ results });
}
