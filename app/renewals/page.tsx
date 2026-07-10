import { prisma } from "@/lib/db";
import { RenewalsHub } from "@/components/renewals/RenewalsHub";
import { RemindersDue } from "@/components/renewals/RemindersDue";
import { RenewalUploadToggle } from "@/components/renewals/RenewalUploadToggle";
import { MissingNotices } from "@/components/renewals/MissingNotices";
import { getDueReminders } from "@/lib/reminders";
import { daysUntil } from "@/lib/format";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function memberSummary(members: { relation: string | null }[]): string {
  if (!members.length) return "";
  return `${members.length} member${members.length > 1 ? "s" : ""}`;
}

export default async function RenewalsPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 90 * DAY);

  const [policies, renewed, due, notices] = await Promise.all([
    prisma.policy.findMany({
      where: { client: { archivedAt: null }, status: { in: ["active", "lapsed"] } },
      orderBy: { renewalDate: "asc" },
      include: { client: { select: { id: true, name: true, phone: true } }, insuredMembers: { select: { relation: true } } },
    }),
    prisma.renewal.findMany({
      where: { status: "renewed", renewedAt: { gte: since }, policy: { client: { archivedAt: null } } },
      orderBy: { renewedAt: "desc" },
      include: { policy: { include: { client: { select: { id: true, name: true, phone: true } } } } },
    }),
    getDueReminders(),
    prisma.document.findMany({ where: { type: "renewal_notice", policyId: { not: null } }, select: { policyId: true } }),
  ]);

  const hasNotice = new Set(notices.map((n) => n.policyId));

  const row = (p: (typeof policies)[number]) => ({
    id: p.id,
    clientId: p.clientId,
    name: p.client.name,
    phone: p.client.phone,
    members: memberSummary(p.insuredMembers),
    product: p.planName || p.variant || p.carrier,
    carrier: p.carrier,
    line: p.line,
    premium: p.premium,
    policyNumber: p.policyNumber,
    renewalDate: p.renewalDate.toISOString(),
    days: daysUntil(p.renewalDate),
    status: p.status,
    hasNotice: hasNotice.has(p.id),
  });

  const all = policies.map(row);
  const immediate = all.filter((p) => p.status === "active" && p.days >= 0 && p.days <= 7);
  const recommended = all.filter((p) => p.status === "active" && p.days >= 8 && p.days <= 30).sort((a, b) => b.premium - a.premium);
  const lapsed = all.filter((p) => p.status === "lapsed" || (p.status === "active" && p.days < 0)).sort((a, b) => a.days - b.days);
  // Policies due within a month whose renewal notice hasn't been uploaded yet.
  const missingNotice = all.filter((p) => p.status === "active" && p.days >= 0 && p.days <= 30 && !p.hasNotice).sort((a, b) => a.days - b.days);

  const recentlyRenewed = renewed.map((r) => ({
    id: r.id,
    clientId: r.policy.clientId,
    name: r.policy.client.name,
    phone: r.policy.client.phone,
    members: "",
    product: r.policy.planName || r.policy.variant || r.policy.carrier,
    carrier: r.policy.carrier,
    line: r.policy.line,
    premium: r.amount,
    policyNumber: r.policy.policyNumber,
    renewalDate: r.renewedAt!.toISOString(),
    days: 0,
    status: "renewed" as const,
  }));

  const summary = {
    count7: immediate.length,
    premium7: immediate.reduce((s, p) => s + p.premium, 0),
    lapsedCount: lapsed.length,
    lapsedPremium: lapsed.reduce((s, p) => s + p.premium, 0),
  };

  return (
    <div className="space-y-4">
      <RenewalUploadToggle />
      <MissingNotices rows={missingNotice} />
      <RemindersDue due={due} />
      <RenewalsHub immediate={immediate} recommended={recommended} lapsed={lapsed} recentlyRenewed={recentlyRenewed} summary={summary} />
    </div>
  );
}
