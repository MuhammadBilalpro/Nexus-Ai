import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { formatRelative } from "@/lib/format";
import type { ActionStatus } from "@/generated/prisma/enums";
import type { AgentOption, ConversationDTO, ConversationSummaryDTO, MessageDTO, StructuredAnswer } from "./types";

/** Conversations belong to one user; every query here takes the owner id. */
export const listConversations = cache(async (userId: string, limit = 40): Promise<ConversationSummaryDTO[]> => {
  const rows = await db.conversation.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: limit, select: { id: true, title: true, agentKey: true, updatedAt: true } });
  return rows.map((r) => ({ id: r.id, title: r.title, agentKey: r.agentKey, updatedAt: r.updatedAt.toISOString(), updatedLabel: formatRelative(r.updatedAt) }));
});

export const getConversation = cache(async (userId: string, conversationId: string): Promise<ConversationDTO | null> => {
  const row = await db.conversation.findFirst({
    where: { id: conversationId, userId },
    select: { id: true, title: true, agentKey: true, updatedAt: true, messages: { orderBy: { createdAt: "asc" }, select: { id: true, role: true, content: true, structured: true, createdAt: true } } },
  });
  if (!row) return null;

  // Proposed-action status may have changed since the answer was stored: refresh it.
  const actionIds = row.messages.flatMap((m) => ((m.structured as StructuredAnswer | null)?.proposedActions ?? []).map((a) => a.id));
  const statuses = actionIds.length ? new Map((await db.proposedAction.findMany({ where: { id: { in: actionIds } }, select: { id: true, status: true } })).map((a) => [a.id, a.status as ActionStatus])) : new Map<string, ActionStatus>();

  const messages: MessageDTO[] = row.messages.map((m) => {
    const structured = m.structured as StructuredAnswer | null;
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      structured: structured ? { ...structured, proposedActions: structured.proposedActions?.map((a) => ({ ...a, status: statuses.get(a.id) ?? a.status })) } : null,
      createdAt: m.createdAt.toISOString(),
    };
  });
  return { id: row.id, title: row.title, agentKey: row.agentKey, updatedAt: row.updatedAt.toISOString(), updatedLabel: formatRelative(row.updatedAt), messages };
});

export const listAgentOptions = cache(async (): Promise<AgentOption[]> => {
  const rows = await db.agent.findMany({ orderBy: { name: "asc" }, select: { key: true, name: true, purpose: true } });
  return rows.map((r) => ({ key: r.key, name: r.name, purpose: r.purpose }));
});

export const isDemoMode = (): boolean => env.DEMO_MODE;
