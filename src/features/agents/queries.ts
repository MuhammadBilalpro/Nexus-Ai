import "server-only";
import { cache } from "react";
import { subHours } from "date-fns";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { formatRelative } from "@/lib/format";
import { ActionStatus, AgentKey, RunStatus, type AgentStatus } from "@/generated/prisma/enums";

const AGENT_KEYS = new Set<string>(Object.values(AgentKey));

const demoFilter = () => (env.DEMO_MODE ? {} : { isDemo: false });

export interface AgentCardDTO {
  id: string;
  key: AgentKey;
  slug: string;
  name: string;
  purpose: string;
  description: string;
  status: AgentStatus;
  permissions: string[];
  latestRun: { summary: string; status: RunStatus; startedAt: string; label: string } | null;
  /** Ran within the last 24 hours. */
  live: boolean;
  completed: number;
  pendingApprovals: number;
}

export const listAgents = cache(async (): Promise<AgentCardDTO[]> => {
  const demo = demoFilter();
  const since = subHours(new Date(), 24);
  const agents = await db.agent.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true, key: true, name: true, purpose: true, description: true, status: true, permissions: true,
      runs: { where: demo, orderBy: { startedAt: "desc" }, take: 1, select: { summary: true, status: true, startedAt: true } },
      _count: { select: { runs: { where: { ...demo, status: RunStatus.SUCCEEDED } }, actions: { where: { ...demo, status: ActionStatus.PENDING } } } },
    },
  });
  return agents.map((a) => {
    const r = a.runs[0];
    return {
      id: a.id, key: a.key, slug: a.key.toLowerCase(), name: a.name, purpose: a.purpose, description: a.description, status: a.status, permissions: a.permissions,
      latestRun: r ? { summary: r.summary, status: r.status, startedAt: r.startedAt.toISOString(), label: formatRelative(r.startedAt) } : null,
      live: r ? r.startedAt >= since : false,
      completed: a._count.runs,
      pendingApprovals: a._count.actions,
    };
  });
});

export interface ProposedActionDTO {
  id: string;
  agentKey: AgentKey;
  agentName: string;
  agentSlug: string;
  kind: string;
  title: string;
  rationale: string;
  risk: string;
  status: ActionStatus;
  payloadSummary: string;
  createdAt: string;
  createdLabel: string;
  decidedLabel: string | null;
  decidedBy: string | null;
}

function summarisePayload(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const entries = Object.entries(payload as Record<string, unknown>).filter(([k, v]) => v !== null && v !== undefined && v !== "" && !/id$/i.test(k));
  return entries
    .slice(0, 4)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export const listProposedActions = cache(async (opts: { agentKey?: AgentKey; limit?: number } = {}): Promise<{ pending: ProposedActionDTO[]; history: ProposedActionDTO[] }> => {
  const rows = await db.proposedAction.findMany({
    where: { ...demoFilter(), ...(opts.agentKey ? { agent: { key: opts.agentKey } } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
    select: { id: true, kind: true, title: true, rationale: true, risk: true, status: true, payload: true, createdAt: true, decidedAt: true, decidedById: true, agent: { select: { key: true, name: true } } },
  });
  const deciderIds = [...new Set(rows.map((r) => r.decidedById).filter((v): v is string => Boolean(v)))];
  const deciders = deciderIds.length ? new Map((await db.user.findMany({ where: { id: { in: deciderIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name ?? "Unknown"])) : new Map<string, string>();
  const all: ProposedActionDTO[] = rows.map((r) => ({
    id: r.id, agentKey: r.agent.key, agentName: r.agent.name, agentSlug: r.agent.key.toLowerCase(), kind: r.kind, title: r.title, rationale: r.rationale, risk: r.risk, status: r.status,
    payloadSummary: summarisePayload(r.payload),
    createdAt: r.createdAt.toISOString(), createdLabel: formatRelative(r.createdAt),
    decidedLabel: r.decidedAt ? formatRelative(r.decidedAt) : null,
    decidedBy: r.decidedById ? deciders.get(r.decidedById) ?? null : null,
  }));
  return { pending: all.filter((a) => a.status === ActionStatus.PENDING), history: all.filter((a) => a.status !== ActionStatus.PENDING) };
});

export interface AgentDetailDTO extends AgentCardDTO {
  stats: { total: number; succeeded: number; awaiting: number; failed: number };
  runs: { id: string; trigger: string; summary: string; status: RunStatus; durationMs: number | null; startedAt: string; label: string }[];
}

export const getAgentBySlug = cache(async (slug: string): Promise<AgentDetailDTO | null> => {
  const key = slug.toUpperCase();
  if (!AGENT_KEYS.has(key)) return null;
  const demo = demoFilter();
  const agent = await db.agent.findUnique({
    where: { key: key as AgentKey },
    select: {
      id: true, key: true, name: true, purpose: true, description: true, status: true, permissions: true,
      runs: { where: demo, orderBy: { startedAt: "desc" }, take: 30, select: { id: true, trigger: true, summary: true, status: true, durationMs: true, startedAt: true } },
      _count: { select: { actions: { where: { ...demo, status: ActionStatus.PENDING } } } },
    },
  });
  if (!agent) return null;
  const grouped = await db.agentRun.groupBy({ by: ["status"], where: { ...demo, agentId: agent.id }, _count: { _all: true } });
  const count = (s: RunStatus) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const since = subHours(new Date(), 24);
  const latest = agent.runs[0];
  return {
    id: agent.id, key: agent.key, slug: agent.key.toLowerCase(), name: agent.name, purpose: agent.purpose, description: agent.description, status: agent.status, permissions: agent.permissions,
    latestRun: latest ? { summary: latest.summary, status: latest.status, startedAt: latest.startedAt.toISOString(), label: formatRelative(latest.startedAt) } : null,
    live: latest ? latest.startedAt >= since : false,
    completed: count(RunStatus.SUCCEEDED),
    pendingApprovals: agent._count.actions,
    stats: { total: grouped.reduce((n, g) => n + g._count._all, 0), succeeded: count(RunStatus.SUCCEEDED), awaiting: count(RunStatus.AWAITING_APPROVAL), failed: count(RunStatus.FAILED) },
    runs: agent.runs.map((r) => ({ id: r.id, trigger: r.trigger, summary: r.summary, status: r.status, durationMs: r.durationMs, startedAt: r.startedAt.toISOString(), label: formatRelative(r.startedAt) })),
  };
});
