import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePermission } from "@/server/auth/principal";
import { can } from "@/server/policies";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentKey } from "@/generated/prisma/enums";
import { listConversations, getConversation, listAgentOptions } from "@/features/assistant/queries";
import { AssistantWorkspace } from "@/features/assistant/components/workspace";

export const metadata: Metadata = { title: "Assistant" };

const AGENT_KEYS = new Set<string>(Object.values(AgentKey));

function parseAgent(raw: string | undefined): AgentKey | null {
  if (!raw) return null;
  const key = raw.toUpperCase();
  return AGENT_KEYS.has(key) ? (key as AgentKey) : null;
}

async function Workspace({ userId, userName, conversationId, question, agent, canDecide }: { userId: string; userName: string | null; conversationId: string | null; question: string | null; agent: AgentKey | null; canDecide: boolean }) {
  const [conversations, active, agents] = await Promise.all([listConversations(userId), conversationId ? getConversation(userId, conversationId) : Promise.resolve(null), listAgentOptions()]);
  return (
    <AssistantWorkspace
      // Remount when switching conversations so composer state resets cleanly.
      key={active?.id ?? "new"}
      conversations={conversations}
      active={active}
      agents={agents}
      initialQuestion={question}
      initialAgent={agent}
      canDecide={canDecide}
      userName={userName}
    />
  );
}

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string; agent?: string }> }) {
  const user = await requirePermission("agent:use");
  const { c, q, agent } = await searchParams;
  const conversationId = c && /^c[a-z0-9]{20,30}$/.test(c) ? c : null;
  const question = q?.trim() ? q.trim().slice(0, 600) : null;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-9rem)] flex-col gap-4 lg:flex-row lg:gap-6">
          <div className="hidden lg:block lg:w-60"><Skeleton className="h-8 w-full" /><div className="mt-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div></div>
          <div className="mx-auto w-full max-w-2xl pt-20"><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-8 w-80" /><Skeleton className="mt-2 h-4 w-96" /></div>
        </div>
      }
    >
      <Workspace userId={user.id} userName={user.name} conversationId={question ? null : conversationId} question={question} agent={parseAgent(agent)} canDecide={can(user, "approval:decide")} />
    </Suspense>
  );
}
