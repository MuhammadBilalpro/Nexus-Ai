"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermissionStrict } from "@/server/auth/principal";
import { can, AuthenticationError, AuthorizationError } from "@/server/policies";
import { audit } from "@/server/audit/audit";
import { requestMeta } from "@/server/auth/request-meta";
import { rateLimit } from "@/server/security/rate-limit";
import { ask, deleteConversation, ConversationNotFound } from "@/server/assistant/service";
import { AgentKey } from "@/generated/prisma/enums";

const askSchema = z
  .object({
    conversationId: z.string().cuid().nullable(),
    question: z.string().trim().min(2, "Ask a fuller question.").max(600, "Keep questions under 600 characters."),
    agentKey: z.enum(AgentKey).nullable(),
  })
  .strict();

export type AskActionResult = { ok: true; conversationId: string } | { error: string };

/**
 * Ask the assistant. Creates the conversation when needed, stores both
 * messages, records an AgentRun and any proposed actions, and audits the ask.
 */
export async function askAction(conversationId: string | null, question: string, agentKey: string | null): Promise<AskActionResult> {
  let userId: string | null = null;
  try {
    const user = await requirePermissionStrict("agent:use");
    userId = user.id;
    const parsed = askSchema.safeParse({ conversationId, question, agentKey: agentKey || null });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid question" };

    const limit = await rateLimit.hit(`assistant:${user.id}`, { limit: 60, windowSeconds: 600 });
    if (!limit.allowed) {
      await audit.record({ actorId: user.id, action: "assistant.ask", resourceType: "conversation", outcome: "denied", metadata: { reason: "rate_limited" }, ...(await requestMeta()) });
      return { error: `You have asked a lot in a short time. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} min.` };
    }

    const result = await ask({ userId: user.id, conversationId: parsed.data.conversationId, question: parsed.data.question, agentKey: parsed.data.agentKey, canViewFinancials: can(user, "dashboard:view_financials") });
    await audit.record({
      actorId: user.id,
      action: "assistant.ask",
      resourceType: "conversation",
      resourceId: result.conversationId,
      metadata: { intent: result.answer.intent, agent: result.answer.agentKey, runId: result.runId, proposedActions: result.answer.proposedActions?.length ?? 0 },
      ...(await requestMeta()),
    });
    revalidatePath("/assistant");
    revalidatePath("/agents");
    return { ok: true, conversationId: result.conversationId };
  } catch (err) {
    if (err instanceof AuthenticationError) return { error: "Your session has expired. Sign in again." };
    if (err instanceof AuthorizationError) return { error: "Your role cannot use the assistant." };
    if (err instanceof ConversationNotFound) return { error: "That conversation no longer exists." };
    console.error("[assistant] ask failed", err);
    if (userId) await audit.record({ actorId: userId, action: "assistant.ask", resourceType: "conversation", outcome: "failure", ...(await requestMeta()) });
    return { error: "The answer engine hit a problem. Nothing was changed; try again." };
  }
}

const idSchema = z.object({ conversationId: z.string().cuid() }).strict();

export async function deleteConversationAction(conversationId: string): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requirePermissionStrict("agent:use");
    const parsed = idSchema.safeParse({ conversationId });
    if (!parsed.success) return { error: "Invalid conversation" };
    const removed = await deleteConversation(user.id, parsed.data.conversationId);
    if (!removed) {
      await audit.record({ actorId: user.id, action: "assistant.conversation_delete", resourceType: "conversation", resourceId: parsed.data.conversationId, outcome: "denied", metadata: { reason: "not_owner" }, ...(await requestMeta()) });
      return { error: "Conversation not found" };
    }
    await audit.record({ actorId: user.id, action: "assistant.conversation_delete", resourceType: "conversation", resourceId: parsed.data.conversationId, ...(await requestMeta()) });
    revalidatePath("/assistant");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthenticationError || err instanceof AuthorizationError) return { error: "Not allowed" };
    console.error("[assistant] delete failed", err);
    return { error: "Could not delete the conversation" };
  }
}
