"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { requirePermissionStrict } from "@/server/auth/principal";
import { AuthenticationError, AuthorizationError } from "@/server/policies";
import { audit } from "@/server/audit/audit";
import { requestMeta } from "@/server/auth/request-meta";
import { ActionStatus, AgentStatus } from "@/generated/prisma/enums";

export type ActionResult = { ok: true } | { error: string };

const demoFilter = () => (env.DEMO_MODE ? {} : { isDemo: false });

const decideSchema = z.object({ actionId: z.string().cuid(), decision: z.enum(["APPROVED", "REJECTED"]) }).strict();

/**
 * Approve or reject a proposed action. This records the human decision only;
 * execution belongs to the Phase 4 automation engine, so an approved action is
 * shown as "queued", never as done.
 */
export async function decideActionAction(actionId: string, decision: "APPROVED" | "REJECTED"): Promise<ActionResult> {
  try {
    const user = await requirePermissionStrict("approval:decide");
    const parsed = decideSchema.safeParse({ actionId, decision });
    if (!parsed.success) return { error: "Invalid request" };

    const pending = await db.proposedAction.findFirst({ where: { id: parsed.data.actionId, status: ActionStatus.PENDING, ...demoFilter() }, select: { id: true, kind: true, agentId: true } });
    if (!pending) {
      await audit.record({ actorId: user.id, action: "agent.action_decided", resourceType: "proposed_action", resourceId: parsed.data.actionId, outcome: "denied", metadata: { reason: "not_pending_or_not_found", decision: parsed.data.decision }, ...(await requestMeta()) });
      return { error: "This action has already been decided or does not exist." };
    }

    await db.proposedAction.update({ where: { id: pending.id }, data: { status: parsed.data.decision === "APPROVED" ? ActionStatus.APPROVED : ActionStatus.REJECTED, decidedById: user.id, decidedAt: new Date() } });
    await audit.record({ actorId: user.id, action: "agent.action_decided", resourceType: "proposed_action", resourceId: pending.id, metadata: { decision: parsed.data.decision, kind: pending.kind, agentId: pending.agentId }, ...(await requestMeta()) });
    revalidatePath("/agents");
    revalidatePath("/agents/[key]", "page");
    revalidatePath("/assistant");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthenticationError) return { error: "Your session has expired. Sign in again." };
    if (err instanceof AuthorizationError) return { error: "Your role cannot decide on agent actions." };
    console.error("[agents] decide failed", err);
    return { error: "The decision could not be saved. Try again." };
  }
}

const toggleSchema = z.object({ agentId: z.string().cuid() }).strict();

/** Pause or resume an agent. Requires agent:manage (MFA step-up enforced by the policy layer). */
export async function toggleAgentStatusAction(agentId: string): Promise<ActionResult> {
  try {
    const user = await requirePermissionStrict("agent:manage");
    const parsed = toggleSchema.safeParse({ agentId });
    if (!parsed.success) return { error: "Invalid agent" };
    const agent = await db.agent.findUnique({ where: { id: parsed.data.agentId }, select: { id: true, key: true, status: true } });
    if (!agent) return { error: "Agent not found" };
    const next = agent.status === AgentStatus.ACTIVE ? AgentStatus.PAUSED : AgentStatus.ACTIVE;
    await db.agent.update({ where: { id: agent.id }, data: { status: next } });
    await audit.record({ actorId: user.id, action: "agent.status_changed", resourceType: "agent", resourceId: agent.id, metadata: { key: agent.key, from: agent.status, to: next }, ...(await requestMeta()) });
    revalidatePath("/agents");
    revalidatePath(`/agents/${agent.key.toLowerCase()}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthenticationError) return { error: "Your session has expired. Sign in again." };
    if (err instanceof AuthorizationError) return { error: "Managing agents requires the agent:manage permission and a verified MFA session." };
    console.error("[agents] toggle failed", err);
    return { error: "The agent status could not be changed." };
  }
}
