import "server-only";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { ActionStatus, MessageRole, type AgentKey } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { ProposedActionRef, StructuredAnswer } from "@/features/assistant/types";
import { answerQuestion, type EngineInput } from "./engine";

/**
 * Runs the engine for one question and persists the full trail:
 * conversation → user message → AgentRun → ProposedAction rows → assistant message.
 * Conversations are always scoped by userId so one user can never read or
 * extend another's thread.
 */
export interface AskInput extends EngineInput {
  userId: string;
  conversationId: string | null;
}

export interface AskResult {
  conversationId: string;
  answer: StructuredAnswer;
  runId: string;
}

export const MAX_TITLE = 80;

export function titleFromQuestion(question: string): string {
  const clean = question.replace(/\s+/g, " ").trim();
  return clean.length > MAX_TITLE ? `${clean.slice(0, MAX_TITLE - 1).trimEnd()}…` : clean;
}

export async function ask(input: AskInput): Promise<AskResult> {
  const startedAt = Date.now();

  // 1. Resolve or create the conversation (ownership enforced in the WHERE clause).
  let conversationId = input.conversationId;
  if (conversationId) {
    const owned = await db.conversation.findFirst({ where: { id: conversationId, userId: input.userId }, select: { id: true } });
    if (!owned) throw new ConversationNotFound();
  } else {
    const created = await db.conversation.create({ data: { userId: input.userId, title: titleFromQuestion(input.question), agentKey: input.agentKey ?? undefined }, select: { id: true } });
    conversationId = created.id;
  }

  // 2. Store the question.
  await db.message.create({ data: { conversationId, role: MessageRole.USER, content: input.question } });

  // 3. Run the deterministic engine.
  const result = await answerQuestion(input);
  const agent = await db.agent.findUnique({ where: { key: result.agentKey }, select: { id: true, name: true, key: true } });
  if (!agent) throw new Error(`Agent ${result.agentKey} is not provisioned`);

  // 4. Record the run and any proposals (nothing executes — they wait for a human).
  const run = await db.agentRun.create({
    data: { agentId: agent.id, trigger: "assistant", summary: result.runSummary, status: result.runStatus, durationMs: Date.now() - startedAt, isDemo: env.DEMO_MODE },
    select: { id: true },
  });
  const proposedActions: ProposedActionRef[] = [];
  for (const draft of result.proposedActions) {
    const row = await db.proposedAction.create({
      data: { agentId: agent.id, runId: run.id, kind: draft.kind, title: draft.title, rationale: draft.rationale, risk: draft.risk, payload: draft.payload as Prisma.InputJsonValue, status: ActionStatus.PENDING, isDemo: env.DEMO_MODE },
      select: { id: true },
    });
    proposedActions.push({ ...draft, id: row.id, status: ActionStatus.PENDING });
  }

  // 5. Store the structured answer.
  const answer: StructuredAnswer = {
    intent: result.intent,
    agentKey: agent.key,
    agentName: agent.name,
    summary: result.summary,
    facts: result.facts,
    series: result.series,
    sources: result.sources,
    proposedActions: proposedActions.length ? proposedActions : undefined,
    followUps: result.followUps,
    answeredAt: new Date().toISOString(),
  };
  await db.message.create({ data: { conversationId, role: MessageRole.ASSISTANT, content: result.summary, structured: answer as unknown as Prisma.InputJsonValue } });
  await db.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date(), ...(input.agentKey && { agentKey: input.agentKey }) } });

  return { conversationId, answer, runId: run.id };
}

export async function deleteConversation(userId: string, conversationId: string): Promise<boolean> {
  const res = await db.conversation.deleteMany({ where: { id: conversationId, userId } });
  return res.count > 0;
}

export class ConversationNotFound extends Error {
  constructor() {
    super("Conversation not found");
    this.name = "ConversationNotFound";
  }
}

export type { AgentKey };
