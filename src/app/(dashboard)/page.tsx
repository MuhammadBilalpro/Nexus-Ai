import type { Metadata } from "next";
import { Suspense } from "react";
import { format } from "date-fns";
import { requirePermission } from "@/server/auth/principal";
import { can } from "@/server/policies";
import { Stat } from "@/components/ui/stat";
import { StatSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { formatMoney, formatNumber } from "@/lib/format";
import { parsePeriod, PERIOD_LABELS, PERIODS } from "@/features/dashboard/period";
import { getOverviewKpis, getRevenueTrend, getProjectHealth, getTeamWorkload, getUpcomingDeadlines } from "@/features/dashboard/queries/overview";
import { getTodaysIntelligence, getCompanyHealth } from "@/server/intelligence/digest";
import { TodaysIntelligence } from "@/features/home/components/intelligence";
import { HealthCard } from "@/features/home/components/health-card";
import { RevenueGlance, ProjectsGlance, DeadlinesGlance, CapacityGlance } from "@/features/home/components/glance";

export const metadata: Metadata = { title: "Home" };

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

async function Stats({ period, showFinancials }: { period: ReturnType<typeof parsePeriod>; showFinancials: boolean }) {
  const k = await getOverviewKpis(period);
  const label = PERIOD_LABELS[period].toLowerCase();
  const profitNegative = k.periodProfit.value.startsWith("-");
  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
      <Stat label="Active projects" value={formatNumber(k.activeProjects)} hint={k.delayedProjects > 0 ? `${k.delayedProjects} delayed` : "none delayed"} tone={k.delayedProjects > 0 ? "warning" : undefined} />
      {showFinancials && <Stat label={`Revenue · ${label}`} value={formatMoney(k.periodRevenue.value)} delta={k.periodRevenue.delta} hint="vs. prior period" />}
      {showFinancials && <Stat label="Profitability" value={k.periodProfit.margin === null ? "—" : `${k.periodProfit.margin}%`} hint={`${formatMoney(k.periodProfit.value)} net ${label}`} tone={profitNegative ? "danger" : undefined} />}
      <Stat label="Team capacity" value={k.productivity.percent === null ? "—" : `${k.productivity.percent}%`} hint={`${k.productivity.completedTasks} of ${k.productivity.totalTasksDue} due tasks done`} />
      <Stat label="Deadlines · 7 days" value={formatNumber(k.upcomingDeadlines)} hint={`${k.pendingApprovals} client approvals pending`} />
      {!showFinancials && <Stat label="Completed" value={formatNumber(k.completedProjects)} hint={`delivered ${label}`} />}
    </section>
  );
}
async function Intelligence() {
  return <TodaysIntelligence insights={await getTodaysIntelligence()} />;
}
async function Health() {
  return <HealthCard health={await getCompanyHealth()} />;
}
async function Revenue() {
  return <RevenueGlance data={await getRevenueTrend()} />;
}
async function Projects() {
  return <ProjectsGlance rows={await getProjectHealth(6)} />;
}
async function Deadlines() {
  return <DeadlinesGlance rows={await getUpcomingDeadlines(6)} />;
}
async function Capacity() {
  return <CapacityGlance rows={await getTeamWorkload(5)} />;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requirePermission("dashboard:view");
  const { period: raw } = await searchParams;
  const period = parsePeriod(raw);
  const showFinancials = can(user, "dashboard:view_financials");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-fg-subtle">{format(new Date(), "EEEE, MMMM d")}</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-fg">{greeting()}{user.name ? `, ${user.name.split(" ")[0]}` : ""}.</h1>
          <p className="mt-1 text-[15px] text-fg-muted">Here&apos;s your company at a glance.</p>
        </div>
        <Suspense fallback={<div className="h-8 w-64 skeleton" />}>
          <Tabs param="period" defaultValue="month" size="sm" items={PERIODS.map((p) => ({ label: PERIOD_LABELS[p], value: p }))} />
        </Suspense>
      </div>

      <Suspense fallback={<div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)}</div>}>
        <Stats period={period} showFinancials={showFinancials} />
      </Suspense>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><Suspense fallback={<CardSkeleton rows={5} />}><Intelligence /></Suspense></div>
        <Suspense fallback={<CardSkeleton rows={5} />}><Health /></Suspense>
      </div>

      {showFinancials && <Suspense fallback={<CardSkeleton rows={6} />}><Revenue /></Suspense>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><Suspense fallback={<CardSkeleton rows={5} />}><Projects /></Suspense></div>
        <div className="space-y-4">
          <Suspense fallback={<CardSkeleton rows={4} />}><Deadlines /></Suspense>
          <Suspense fallback={<CardSkeleton rows={4} />}><Capacity /></Suspense>
        </div>
      </div>
    </div>
  );
}
