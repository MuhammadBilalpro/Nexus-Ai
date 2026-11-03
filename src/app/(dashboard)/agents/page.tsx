import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePermission } from "@/server/auth/principal";
import { can } from "@/server/policies";
import { PageHeader } from "@/components/dashboard/page-header";
import { Tabs } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/ui/skeleton";
import { listAgents, listProposedActions } from "@/features/agents/queries";
import { AgentGrid } from "@/features/agents/components/agent-cards";
import { PendingApprovalsList, ApprovalHistory } from "@/features/agents/components/approvals";

export const metadata: Metadata = { title: "Agents" };

async function Overview() {
  return <AgentGrid agents={await listAgents()} />;
}

async function Approvals({ canDecide }: { canDecide: boolean }) {
  const { pending, history } = await listProposedActions();
  return (
    <div className="space-y-4">
      <PendingApprovalsList actions={pending} canDecide={canDecide} />
      <ApprovalHistory actions={history} />
    </div>
  );
}

async function TabsWithCount() {
  const { pending } = await listProposedActions();
  return <Tabs param="tab" defaultValue="overview" items={[{ label: "Overview", value: "overview" }, { label: "Approvals", value: "approvals", count: pending.length }]} />;
}

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("agent:use");
  const { tab } = await searchParams;
  const view = tab === "approvals" ? "approvals" : "overview";
  const canDecide = can(user, "approval:decide");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description="Six specialised agents read company records and propose actions. Nothing executes without your approval."
        actions={
          <Suspense fallback={<div className="h-8 w-56 skeleton" />}>
            <TabsWithCount />
          </Suspense>
        }
      />
      {view === "overview" ? (
        <Suspense fallback={<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} rows={4} />)}</div>}>
          <Overview />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="space-y-4"><CardSkeleton rows={4} /><CardSkeleton rows={3} /></div>}>
          <Approvals canDecide={canDecide} />
        </Suspense>
      )}
    </div>
  );
}
