"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { requirePermissionStrict } from "@/server/auth/principal";
import { AuthenticationError, AuthorizationError } from "@/server/policies";
import { requestMeta } from "@/server/auth/request-meta";
import { audit } from "@/server/audit/audit";
import type { Prisma } from "@/generated/prisma/client";
import { findBlock, type Block, type StepConfig } from "./catalog";
import { validateChain } from "./validation";

export type ActionResult = { ok: true } | { error: string };
export interface CreateWorkflowState {
  error?: string;
  fieldErrors?: { name?: string; description?: string };
}

const MANAGE = "automation:manage" as const;
const id = z.string().cuid();
const demoFilter = () => (env.DEMO_MODE ? {} : { isDemo: false });

const nameSchema = z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Keep the name under 80 characters");
const descriptionSchema = z.string().trim().max(300, "Keep the description under 300 characters");

function toError(err: unknown): ActionResult {
  if (err instanceof AuthorizationError) return { error: "You do not have permission to manage automation. Two-factor authentication is required for this action." };
  if (err instanceof AuthenticationError) return { error: "Your session has expired. Sign in again." };
  console.error("[automation] action failed", err);
  return { error: "Something went wrong. Try again." };
}

async function ownedWorkflow(workflowId: string) {
  return db.workflow.findFirst({ where: { id: workflowId, ...demoFilter() }, select: { id: true, name: true, isDemo: true } });
}

/** Rewrite step orders to 0..n-1 inside a transaction without violating the (workflowId, order) unique index. */
async function renumber(tx: Prisma.TransactionClient, workflowId: string, orderedStepIds: string[]): Promise<void> {
  // Park every step on a negative order first, then assign the final sequence.
  await Promise.all(orderedStepIds.map((stepId, i) => tx.workflowStep.update({ where: { id: stepId }, data: { order: -1000 - i } })));
  await Promise.all(orderedStepIds.map((stepId, i) => tx.workflowStep.update({ where: { id: stepId }, data: { order: i } })));
}

/** Validate a config object against the block's declared fields; unknown keys are dropped. */
function parseConfig(block: Block, raw: unknown): { config: StepConfig } | { error: string } {
  if (!block.configFields?.length) return { config: {} };
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of block.configFields) {
    if (f.input === "number") {
      let n = z.coerce.number().finite();
      if (f.min !== undefined) n = n.min(f.min, `${f.label} must be at least ${f.min}`);
      if (f.max !== undefined) n = n.max(f.max, `${f.label} must be at most ${f.max}`);
      shape[f.key] = z.union([z.literal(""), z.null(), z.undefined(), n]).transform((v) => (v === "" || v === undefined ? null : v));
    } else if (f.input === "select") {
      const values = (f.options ?? []).map((o) => o.value) as [string, ...string[]];
      shape[f.key] = z.union([z.literal(""), z.null(), z.undefined(), z.enum(values)]).transform((v) => (v === "" || v === undefined ? null : v));
    } else {
      shape[f.key] = z.union([z.null(), z.undefined(), z.string().trim().max(120)]).transform((v) => (v === "" || v === undefined ? null : v));
    }
  }
  const parsed = z.object(shape).safeParse(raw ?? {});
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid configuration" };
  return { config: parsed.data as StepConfig };
}

// ───────────────────────── Workflows ─────────────────────────

export async function createWorkflowAction(_prev: CreateWorkflowState, formData: FormData): Promise<CreateWorkflowState> {
  let user;
  try {
    user = await requirePermissionStrict(MANAGE);
  } catch (err) {
    const r = toError(err);
    return { error: "error" in r ? r.error : undefined };
  }
  const parsed = z.object({ name: nameSchema, description: descriptionSchema.optional().or(z.literal("")) }).strict().safeParse({ name: formData.get("name"), description: formData.get("description") ?? "" });
  if (!parsed.success) {
    const fieldErrors: CreateWorkflowState["fieldErrors"] = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (k === "name" || k === "description") fieldErrors[k] ??= i.message;
    }
    return { fieldErrors };
  }
  const wf = await db.workflow.create({ data: { name: parsed.data.name, description: parsed.data.description || null, enabled: false, isDemo: env.DEMO_MODE } });
  await audit.record({ actorId: user.id, action: "automation.workflow_create", resourceType: "workflow", resourceId: wf.id, metadata: { name: wf.name }, ...(await requestMeta()) });
  revalidatePath("/automation");
  redirect(`/automation/${wf.id}`);
}

const updateWorkflowSchema = z.object({ workflowId: id, name: nameSchema, description: descriptionSchema }).strict();

export async function updateWorkflowAction(input: z.infer<typeof updateWorkflowSchema>): Promise<ActionResult> {
  try {
    const user = await requirePermissionStrict(MANAGE);
    const parsed = updateWorkflowSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    const wf = await ownedWorkflow(parsed.data.workflowId);
    if (!wf) return { error: "Workflow not found" };
    await db.workflow.update({ where: { id: wf.id }, data: { name: parsed.data.name, description: parsed.data.description || null } });
    await audit.record({ actorId: user.id, action: "automation.workflow_update", resourceType: "workflow", resourceId: wf.id, metadata: { name: parsed.data.name }, ...(await requestMeta()) });
    revalidatePath("/automation");
    revalidatePath(`/automation/${wf.id}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

const toggleSchema = z.object({ workflowId: id, enabled: z.boolean() }).strict();

export async function toggleWorkflowAction(input: z.infer<typeof toggleSchema>): Promise<ActionResult> {
  try {
    const user = await requirePermissionStrict(MANAGE);
    const parsed = toggleSchema.safeParse(input);
    if (!parsed.success) return { error: "Invalid input" };
    const wf = await ownedWorkflow(parsed.data.workflowId);
    if (!wf) return { error: "Workflow not found" };
    await db.workflow.update({ where: { id: wf.id }, data: { enabled: parsed.data.enabled } });
    await audit.record({ actorId: user.id, action: parsed.data.enabled ? "automation.workflow_enable" : "automation.workflow_disable", resourceType: "workflow", resourceId: wf.id, ...(await requestMeta()) });
    revalidatePath("/automation");
    revalidatePath(`/automation/${wf.id}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

const deleteSchema = z.object({ workflowId: id }).strict();

export async function deleteWorkflowAction(input: z.infer<typeof deleteSchema>): Promise<ActionResult> {
  let deleted = false;
  try {
    const user = await requirePermissionStrict(MANAGE);
    const parsed = deleteSchema.safeParse(input);
    if (!parsed.success) return { error: "Invalid input" };
    const wf = await ownedWorkflow(parsed.data.workflowId);
    if (!wf) return { error: "Workflow not found" };
    await db.workflow.delete({ where: { id: wf.id } });
    await audit.record({ actorId: user.id, action: "automation.workflow_delete", resourceType: "workflow", resourceId: wf.id, metadata: { name: wf.name }, ...(await requestMeta()) });
    revalidatePath("/automation");
    deleted = true;
  } catch (err) {
    return toError(err);
  }
  if (deleted) redirect("/automation");
  return { ok: true };
}

// ───────────────────────── Steps ─────────────────────────

const addStepSchema = z.object({ workflowId: id, afterOrder: z.number().int().min(-1).max(500), type: z.string().min(1).max(80) }).strict();

export async function addStepAction(input: z.infer<typeof addStepSchema>): Promise<ActionResult> {
  try {
    const user = await requirePermissionStrict(MANAGE);
    const parsed = addStepSchema.safeParse(input);
    if (!parsed.success) return { error: "Invalid input" };
    const block = findBlock(parsed.data.type);
    if (!block) return { error: "Unknown block" };
    const wf = await ownedWorkflow(parsed.data.workflowId);
    if (!wf) return { error: "Workflow not found" };

    const stepId = await db.$transaction(async (tx) => {
      const steps = await tx.workflowStep.findMany({ where: { workflowId: wf.id }, orderBy: { order: "asc" }, select: { id: true, order: true } });
      const created = await tx.workflowStep.create({ data: { workflowId: wf.id, order: 10_000 + steps.length, kind: block.kind, type: block.type, label: block.label, config: {} } });
      const insertAt = steps.findIndex((s) => s.order > parsed.data.afterOrder);
      const ids = steps.map((s) => s.id);
      ids.splice(insertAt === -1 ? ids.length : insertAt, 0, created.id);
      await renumber(tx, wf.id, ids);
      return created.id;
    });

    await audit.record({ actorId: user.id, action: "automation.step_add", resourceType: "workflow_step", resourceId: stepId, metadata: { workflowId: wf.id, type: block.type }, ...(await requestMeta()) });
    revalidatePath("/automation");
    revalidatePath(`/automation/${wf.id}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

const updateStepSchema = z.object({ workflowId: id, stepId: id, label: z.string().trim().min(1, "Label is required").max(120, "Keep the label under 120 characters"), config: z.record(z.string(), z.union([z.string(), z.number(), z.null()])) }).strict();

export async function updateStepAction(input: z.infer<typeof updateStepSchema>): Promise<ActionResult> {
  try {
    const user = await requirePermissionStrict(MANAGE);
    const parsed = updateStepSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    const wf = await ownedWorkflow(parsed.data.workflowId);
    if (!wf) return { error: "Workflow not found" };
    const step = await db.workflowStep.findFirst({ where: { id: parsed.data.stepId, workflowId: wf.id } });
    if (!step) return { error: "Step not found" };
    const block = findBlock(step.type);
    if (!block) return { error: "This step uses a block that is no longer in the catalog. Remove it and add a current one." };
    const cfg = parseConfig(block, parsed.data.config);
    if ("error" in cfg) return { error: cfg.error };
    await db.workflowStep.update({ where: { id: step.id }, data: { label: parsed.data.label, config: cfg.config as Prisma.InputJsonValue } });
    await audit.record({ actorId: user.id, action: "automation.step_update", resourceType: "workflow_step", resourceId: step.id, metadata: { workflowId: wf.id, type: step.type }, ...(await requestMeta()) });
    revalidatePath("/automation");
    revalidatePath(`/automation/${wf.id}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

const reorderSchema = z.object({ workflowId: id, stepId: id, direction: z.enum(["up", "down"]) }).strict();

export async function reorderStepAction(input: z.infer<typeof reorderSchema>): Promise<ActionResult> {
  try {
    const user = await requirePermissionStrict(MANAGE);
    const parsed = reorderSchema.safeParse(input);
    if (!parsed.success) return { error: "Invalid input" };
    const wf = await ownedWorkflow(parsed.data.workflowId);
    if (!wf) return { error: "Workflow not found" };

    const moved = await db.$transaction(async (tx) => {
      const steps = await tx.workflowStep.findMany({ where: { workflowId: wf.id }, orderBy: { order: "asc" }, select: { id: true } });
      const ids = steps.map((s) => s.id);
      const i = ids.indexOf(parsed.data.stepId);
      if (i === -1) return false;
      const j = parsed.data.direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= ids.length) return false;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      await renumber(tx, wf.id, ids);
      return true;
    });
    if (!moved) return { error: "Step cannot move further" };

    await audit.record({ actorId: user.id, action: "automation.step_reorder", resourceType: "workflow_step", resourceId: parsed.data.stepId, metadata: { workflowId: wf.id, direction: parsed.data.direction }, ...(await requestMeta()) });
    revalidatePath("/automation");
    revalidatePath(`/automation/${wf.id}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

const removeStepSchema = z.object({ workflowId: id, stepId: id }).strict();

export async function removeStepAction(input: z.infer<typeof removeStepSchema>): Promise<ActionResult> {
  try {
    const user = await requirePermissionStrict(MANAGE);
    const parsed = removeStepSchema.safeParse(input);
    if (!parsed.success) return { error: "Invalid input" };
    const wf = await ownedWorkflow(parsed.data.workflowId);
    if (!wf) return { error: "Workflow not found" };

    const removed = await db.$transaction(async (tx) => {
      const step = await tx.workflowStep.findFirst({ where: { id: parsed.data.stepId, workflowId: wf.id }, select: { id: true, type: true } });
      if (!step) return null;
      await tx.workflowStep.delete({ where: { id: step.id } });
      const rest = await tx.workflowStep.findMany({ where: { workflowId: wf.id }, orderBy: { order: "asc" }, select: { id: true } });
      await renumber(tx, wf.id, rest.map((s) => s.id));
      return step;
    });
    if (!removed) return { error: "Step not found" };

    await audit.record({ actorId: user.id, action: "automation.step_remove", resourceType: "workflow_step", resourceId: removed.id, metadata: { workflowId: wf.id, type: removed.type }, ...(await requestMeta()) });
    revalidatePath("/automation");
    revalidatePath(`/automation/${wf.id}`);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

// ───────────────────────── Dry run ─────────────────────────

const dryRunSchema = z.object({ workflowId: id }).strict();

/**
 * Validates the chain and records a WorkflowRun. No side effects are executed:
 * live execution ships with the Phase 4 engine.
 */
export async function runWorkflowTestAction(input: z.infer<typeof dryRunSchema>): Promise<ActionResult> {
  try {
    const user = await requirePermissionStrict(MANAGE);
    const parsed = dryRunSchema.safeParse(input);
    if (!parsed.success) return { error: "Invalid input" };
    const wf = await db.workflow.findFirst({ where: { id: parsed.data.workflowId, ...demoFilter() }, include: { steps: { orderBy: { order: "asc" } } } });
    if (!wf) return { error: "Workflow not found" };

    const started = Date.now();
    const result = validateChain(wf.steps);
    const firstError = result.items.find((i) => i.level === "error");
    const status = firstError ? "failed" : "succeeded";
    const summary = firstError ? `Dry run failed: ${firstError.message}` : `Dry run: ${wf.steps.length} steps validated${result.pausesAt.length ? ` (would pause at step ${result.pausesAt.map((o) => o + 1).join(", ")} — integration not connected)` : ""}`;
    await db.workflowRun.create({ data: { workflowId: wf.id, status, summary, durationMs: Math.max(1, Date.now() - started), isDemo: wf.isDemo } });

    await audit.record({ actorId: user.id, action: "automation.dry_run", resourceType: "workflow", resourceId: wf.id, outcome: firstError ? "failure" : "success", metadata: { status, steps: wf.steps.length }, ...(await requestMeta()) });
    revalidatePath("/automation");
    revalidatePath(`/automation/${wf.id}`);
    return firstError ? { error: summary } : { ok: true };
  } catch (err) {
    return toError(err);
  }
}
