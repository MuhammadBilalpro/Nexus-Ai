import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePermission } from "@/server/auth/principal";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/dashboard/page-header";
import { KpiSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { parsePeriod, PERIOD_LABELS } from "@/features/dashboard/period";
import { getOverviewKpis, getRevenueTrend, getProjectHealth, getTeamWorkload, getRecentActivity, getUpcomingDeadlines, getCriticalAlerts } from "@/features/dashboard/queries/overview";
import { KpiGrid } from "@/features/dashboard/components/kpi-grid";
import { RevenueCard, ProjectHealthCard, WorkloadCard, AlertsCard, DeadlinesCard, ActivityCard, PhaseNotice } from "@/features/dashboard/components/widgets";

export const metadata: Metadata = { title: "Executive dashboard" };

/* Each section streams independently so a slow query never blocks the page. */

async function Kpis({ period, showFinancials }: { period: ReturnType<typeof parsePeriod>; showFinancials: boolean }) {
  const kpis = await getOverviewKpis(period);
  return <KpiGrid kpis={kpis} period={period} showFinancials={showFinancials} />;
}
async function Revenue() {
  return <RevenueCard data={await getRevenueTrend()} />;
}
async function Alerts() {
  return <AlertsCard alerts={await getCriticalAlerts()} />;
}
async function Projects() {
  return <ProjectHealthCard rows={await getProjectHealth()} />;
}
async function Workload() {
  return <WorkloadCard rows={await getTeamWorkload()} />;
}
async function Deadlines() {
  return <DeadlinesCard rows={await getUpcomingDeadlines()} />;
}
async function Feed() {
  return <ActivityCard rows={await getRecentActivity()} />;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requirePermission("dashboard:view");
  const { period: rawPeriod } = await searchParams;
  const period = parsePeriod(rawPeriod);
  const showFinancials = can(user, "dashboard:view_financials");
  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <PageHeader title={`Good ${greeting()}, ${firstName}`} description={`Company position for ${PERIOD_LABELS[period].toLowerCase()}, computed from live records.`} />

      <Suspense fallback={<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <KpiSkeleton key={i} />)}</div>}>
        <Kpis period={period} showFinancials={showFinancials} />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {showFinancials ? (
          <div className="xl:col-span-2"><Suspense fallback={<CardSkeleton rows={6} />}><Revenue /></Suspense></div>
        ) : (
          <div className="xl:col-span-2"><Suspense fallback={<CardSkeleton rows={6} />}><Projects /></Suspense></div>
        )}
        <Suspense fallback={<CardSkeleton rows={5} />}><Alerts /></Suspense>
      </div>

      {showFinancials && <Suspense fallback={<CardSkeleton rows={6} />}><Projects /></Suspense>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Suspense fallback={<CardSkeleton rows={6} />}><Workload /></Suspense>
        <Suspense fallback={<CardSkeleton rows={6} />}><Deadlines /></Suspense>
        <Suspense fallback={<CardSkeleton rows={6} />}><Feed /></Suspense>
      </div>

      <PhaseNotice />
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}
