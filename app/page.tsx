import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { getDashboardData, type Range } from "@/lib/insights";
import { fmtDate } from "@/lib/format";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { GlobalSearch } from "@/components/GlobalSearch";
import { TimeFilter } from "@/components/dashboard/TimeFilter";
import { HeadlineRow, BusinessDashboardButton } from "@/components/dashboard/HeadlineRow";
import { FirstRun } from "@/components/dashboard/FirstRun";
import { QuickFilters } from "@/components/dashboard/QuickFilters";
import { NextBestAction } from "@/components/dashboard/NextBestAction";
import { AlertsStrip } from "@/components/dashboard/AlertsStrip";
import { RemindersDue } from "@/components/renewals/RemindersDue";
import { getDueReminders } from "@/lib/reminders";
import { ApprovalsPanel } from "@/components/dashboard/ApprovalsPanel";
import { getPendingApprovals } from "@/lib/outbox";
import { OpsTiles } from "@/components/dashboard/OpsTiles";
import { MorningBriefing } from "@/components/dashboard/MorningBriefing";
import { BusinessPulse } from "@/components/dashboard/BusinessPulse";
import { TasksWidget } from "@/components/dashboard/TasksWidget";
import { QuickAddTask } from "@/components/tasks/QuickAddTask";
import { CrossSell } from "@/components/dashboard/CrossSell";
import { RenewalsList } from "@/components/dashboard/RenewalsList";
import { StickyTopActions } from "@/components/dashboard/StickyTopActions";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const sp = await searchParams;
  const range: Range = sp?.range === "today" || sp?.range === "month" ? sp.range : "week";

  const [d, clients, due, approvals] = await Promise.all([
    getDashboardData(range),
    prisma.client.findMany({ where: { archivedAt: null }, select: { id: true, name: true, phone: true }, orderBy: { name: "asc" } }),
    getDueReminders(),
    getPendingApprovals(),
  ]);

  // first run: an empty book gets one clear starting point, not a wall of zeros
  if (d.kpis.clients === 0) {
    return (
      <div className="space-y-3.5 md:space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">Dashboard</h1>
          <p className="text-xs text-ink-3">{fmtDate(d.generatedAt)}</p>
        </div>
        <FirstRun />
      </div>
    );
  }

  return (
    <div className="space-y-3.5 md:space-y-4">
      <QuickAddTask clients={clients} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Dashboard</h1>
          <p className="text-xs text-ink-3">{fmtDate(d.generatedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <BusinessDashboardButton />
          <Suspense fallback={null}>
            <TimeFilter />
          </Suspense>
        </div>
      </div>

      {/* prominent global search (customer name / policy number) */}
      <GlobalSearch />

      <QuickActions />

      {/* top headline KPIs + quick-filter chips (wireframe) */}
      <HeadlineRow h={d.headline} />
      <QuickFilters chips={d.quickFilters} />

      {/* reminders ready to send (auto-hidden when none due) */}
      <RemindersDue due={due} />

      {/* engine-prepared messages awaiting a one-tap send (auto-hidden when empty) */}
      <ApprovalsPanel items={approvals} />

      {/* what needs attention now */}
      <AlertsStrip alerts={d.alerts} />
      <NextBestAction action={d.nextBestAction} />

      {/* AI Summary (left) + Operations & Tasks (right) */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.7fr_1fr] md:gap-4">
        <MorningBriefing greeting={d.greeting} items={d.briefing} generatedAt={d.generatedAt} range={range} />
        <div className="space-y-3.5 md:space-y-4">
          <OpsTiles ops={d.ops} />
          <TasksWidget tasks={d.tasksDue} />
        </div>
      </div>

      {/* Cross-sell spotlights */}
      <CrossSell items={d.crossSell.items} totalCommission={d.crossSell.totalCommission} />

      {/* Upcoming / overdue renewals strip */}
      <RenewalsList items={d.upcomingRenewals} />

      {/* Business pulse (Business Dashboard button target) */}
      <div id="business-pulse" className="scroll-mt-4">
        <BusinessPulse score={d.bookHealth.score} sub={d.bookHealth.sub} trendDelta={d.bookHealth.trendDelta} />
      </div>

      <p className="pt-1 text-center text-[11px] text-ink-4">
        Live data from your local database · add your Claude key in <code>.env</code> to power the AI assistant &amp; briefing
      </p>

      <StickyTopActions actions={d.smartActions} />
    </div>
  );
}
