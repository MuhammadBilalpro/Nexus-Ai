import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePermission } from "@/server/auth/principal";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/ui/skeleton";
import { getRevenueTrend } from "@/features/dashboard/queries/overview";
import { getRevenueStats, getRevenueByProject, getReceivables, getProfitability, getProjectPerformance, getWorkload, getClients, getOpportunitySignals } from "@/features/insights/queries";
import { FinancialsLocked, ViewSkeleton } from "@/features/insights/components/shared";
import { RevenueStatsRow, RevenueTrendCard, RevenueByProjectCard, ReceivablesTable } from "@/features/insights/components/revenue-view";
import { ProfitabilityStats, ProfitabilityTable, MarginChart } from "@/features/insights/components/profitability-view";
import { ProjectStats, ThroughputCard, PerformanceTable } from "@/features/insights/components/projects-view";
import { WorkloadTable, WorkloadChart } from "@/features/insights/components/workload-view";
import { ClientsTable, ClientRevenueChart } from "@/features/insights/components/clients-view";
import { OpportunitiesView } from "@/features/insights/components/opportunities-view";

export const metadata: Metadata = { title: "Insights" };

const VIEWS = ["revenue", "profitability", "projects", "workload", "clients", "opportunities"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = { revenue: "Revenue", profitability: "Profitability", projects: "Projects", workload: "Workload", clients: "Clients", opportunities: "Opportunities" };
const FINANCIAL: ReadonlySet<View> = new Set<View>(["revenue", "profitability", "clients"]);

function parseView(v: string | undefined): View {
  return (VIEWS as readonly string[]).includes(v ?? "") ? (v as View) : "revenue";
}

async function RevenueView() {
  const [stats, trend, byProject, receivables] = await Promise.all([getRevenueStats(), getRevenueTrend(), getRevenueByProject(8), getReceivables()]);
  return (
    <div className="space-y-4">
      <RevenueStatsRow s={stats} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3"><RevenueTrendCard data={trend} /></div>
        <div className="xl:col-span-2"><RevenueByProjectCard rows={byProject} /></div>
      </div>
      <ReceivablesTable rows={receivables} />
    </div>
  );
}

async function ProfitabilityView() {
  const d = await getProfitability();
  return (
    <div className="space-y-4">
      <ProfitabilityStats d={d} />
      <ProfitabilityTable rows={d.rows} />
      <MarginChart rows={d.rows} />
    </div>
  );
}

async function ProjectsView() {
  const d = await getProjectPerformance();
  return (
    <div className="space-y-4">
      <ProjectStats d={d} />
      <PerformanceTable rows={d.rows} />
      <ThroughputCard weekly={d.weekly} />
    </div>
  );
}

async function WorkloadView() {
  const rows = await getWorkload();
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2"><WorkloadTable rows={rows} /></div>
      <WorkloadChart rows={rows} />
    </div>
  );
}

async function ClientsView() {
  const rows = await getClients();
  return (
    <div className="space-y-4">
      <ClientsTable rows={rows} />
      <ClientRevenueChart rows={rows} />
    </div>
  );
}

async function OpportunitiesViewAsync() {
  return <OpportunitiesView signals={await getOpportunitySignals()} />;
}

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requirePermission("dashboard:view");
  const { view: raw } = await searchParams;
  const view = parseView(raw);
  const showFinancials = can(user, "dashboard:view_financials");

  let body: React.ReactNode;
  if (FINANCIAL.has(view) && !showFinancials) {
    body = <FinancialsLocked />;
  } else {
    switch (view) {
      case "revenue":
        body = <Suspense fallback={<ViewSkeleton />}><RevenueView /></Suspense>;
        break;
      case "profitability":
        body = <Suspense fallback={<ViewSkeleton />}><ProfitabilityView /></Suspense>;
        break;
      case "projects":
        body = <Suspense fallback={<ViewSkeleton rows={8} />}><ProjectsView /></Suspense>;
        break;
      case "workload":
        body = <Suspense fallback={<div className="grid grid-cols-1 gap-4 xl:grid-cols-3"><CardSkeleton className="xl:col-span-2" rows={8} /><CardSkeleton rows={8} /></div>}><WorkloadView /></Suspense>;
        break;
      case "clients":
        body = <Suspense fallback={<div className="space-y-4"><CardSkeleton rows={4} /><CardSkeleton rows={4} /></div>}><ClientsView /></Suspense>;
        break;
      case "opportunities":
        body = <Suspense fallback={<div className="grid grid-cols-1 gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} rows={3} />)}</div>}><OpportunitiesViewAsync /></Suspense>;
        break;
    }
  }

  return (
    <div>
      <PageHeader
        title="Insights"
        description="Revenue, margin, delivery and capacity, computed from your records."
        actions={
          <Suspense fallback={<div className="h-8 w-96 skeleton" />}>
            <Tabs param="view" defaultValue="revenue" size="sm" items={VIEWS.map((v) => ({ label: VIEW_LABELS[v], value: v }))} />
          </Suspense>
        }
      />
      <div key={view} className="animate-fade-in">{body}</div>
    </div>
  );
}
