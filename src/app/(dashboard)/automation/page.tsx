import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePermission } from "@/server/auth/principal";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/dashboard/page-header";
import { Stat } from "@/components/ui/stat";
import { StatSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { getAutomationStats, listWorkflows } from "@/features/automation/queries";
import { WorkflowList } from "@/features/automation/components/workflow-list";
import { NewWorkflowForm } from "@/features/automation/components/new-workflow-form";

export const metadata: Metadata = { title: "Automation" };

async function Stats() {
  const s = await getAutomationStats();
  return (
    <section aria-label="Automation metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Workflows enabled" value={formatNumber(s.enabled)} hint={`of ${formatNumber(s.total)} total`} />
      <Stat label="Runs · 7 days" value={formatNumber(s.runsLast7Days)} hint="dry runs included" />
      <Stat label="Awaiting approval" value={formatNumber(s.awaitingApproval)} hint="paused for a human decision" tone={s.awaitingApproval > 0 ? "warning" : undefined} />
      <Stat label="Failed · 7 days" value={formatNumber(s.failed)} hint={s.failed > 0 ? "needs attention" : "none failed"} tone={s.failed > 0 ? "danger" : undefined} />
    </section>
  );
}

async function List({ canManage }: { canManage: boolean }) {
  return <WorkflowList rows={await listWorkflows()} canManage={canManage} />;
}

export default async function AutomationPage() {
  const user = await requirePermission("automation:read");
  const canManage = can(user, "automation:manage");
  return (
    <div className="space-y-6">
      <PageHeader title="Automation" description="Workflows that connect triggers, conditions, AI agents and actions. Nothing runs without a trigger you define." actions={canManage ? <NewWorkflowForm /> : undefined} />
      <Suspense fallback={<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}</div>}>
        <Stats />
      </Suspense>
      <Suspense fallback={<CardSkeleton rows={6} />}>
        <List canManage={canManage} />
      </Suspense>
    </div>
  );
}
