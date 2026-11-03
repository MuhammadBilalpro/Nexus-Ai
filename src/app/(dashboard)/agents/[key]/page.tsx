import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/server/auth/principal";
import { can } from "@/server/policies";
import { CardSkeleton, StatSkeleton } from "@/components/ui/skeleton";
import type { AgentKey } from "@/generated/prisma/enums";
import { getAgentBySlug, listProposedActions } from "@/features/agents/queries";
import { AgentIdentity, AgentStats, ExecutionHistory, PermissionsCard } from "@/features/agents/components/agent-detail";
import { PendingApprovalsList } from "@/features/agents/components/approvals";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const agent = await getAgentBySlug(key);
  return { title: agent ? agent.name : "Agent" };
}

async function Approvals({ agentKey, canDecide }: { agentKey: AgentKey; canDecide: boolean }) {
  const { pending } = await listProposedActions({ agentKey });
  return <PendingApprovalsList actions={pending} canDecide={canDecide} showAgent={false} description={pending.length === 0 ? "This agent has nothing waiting for a decision." : `${pending.length} proposal${pending.length === 1 ? "" : "s"} from this agent waiting for a decision.`} />;
}

export default async function AgentDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const user = await requirePermission("agent:use");
  const { key } = await params;
  if (!/^[a-z_]+$/.test(key)) notFound();
  const agent = await getAgentBySlug(key);
  if (!agent) notFound();

  return (
    <div className="space-y-6">
      <Link href="/agents" className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg">
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> All agents
      </Link>
      <AgentIdentity agent={agent} canManage={can(user, "agent:manage")} />
      <Suspense fallback={<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}</div>}>
        <AgentStats stats={agent.stats} />
      </Suspense>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Suspense fallback={<CardSkeleton rows={3} />}>
            <Approvals agentKey={agent.key} canDecide={can(user, "approval:decide")} />
          </Suspense>
          <ExecutionHistory runs={agent.runs} />
        </div>
        <PermissionsCard agent={agent} />
      </div>
    </div>
  );
}
