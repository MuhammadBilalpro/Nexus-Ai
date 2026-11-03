"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { requirePermissionStrict, type CurrentUser } from "@/server/auth/principal";
import { AuthorizationError, AuthenticationError, type Permission } from "@/server/policies";
import { requestMeta } from "@/server/auth/request-meta";
import { audit } from "@/server/audit/audit";
import { Prisma } from "@/generated/prisma/client";
import { ProjectStatus, TaskStatus, MilestoneStatus } from "@/generated/prisma/enums";
import { humanize } from "@/lib/format";
import { recomputeProjectHealth } from "./health";
import { createProjectSchema, updateProjectStatusSchema, createTaskSchema, updateTaskStatusSchema, addProjectMemberSchema, completeMilestoneSchema } from "./schemas";

export type ActionResult = { ok: true; slug?: string } | { error: string; fieldErrors?: Record<string, string> };

const demoFilter = () => (env.DEMO_MODE ? {} : { isDemo: false });

/** Resolve the actor or map auth failures to a result the UI can show. */
async function actor(permission: Permission): Promise<CurrentUser | { error: string }> {
  try {
    return await requirePermissionStrict(permission);
  } catch (err) {
    if (err instanceof AuthenticationError) return { error: "Sign in to continue." };
    if (err instanceof AuthorizationError) return { error: "You do not have permission to do that." };
    throw err;
  }
}
const denied = (u: CurrentUser | { error: string }): u is { error: string } => "error" in u;

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "form");
    out[k] ??= i.message;
  }
  return out;
}

function formObject(formData: FormData, keys: readonly string[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const k of keys) {
    const v = formData.get(k);
    if (v !== null) o[k] = typeof v === "string" ? v : undefined;
  }
  return o;
}

function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "project";
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const taken = new Set((await db.project.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((p) => p.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

async function activity(type: string, message: string, actorId: string, projectId: string, isDemo: boolean): Promise<void> {
  await db.activity.create({ data: { type, message, actorId, projectId, isDemo } });
}

// ───────── Projects ─────────

export async function createProjectAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await actor("project:create");
  if (denied(user)) return user;
  const parsed = createProjectSchema.safeParse(formObject(formData, ["name", "category", "budget", "deadline", "startDate", "managerId", "description"]));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  if (d.managerId) {
    const exists = await db.user.findFirst({ where: { id: d.managerId, isActive: true }, select: { id: true } });
    if (!exists) return { error: "Check the highlighted fields.", fieldErrors: { managerId: "Unknown manager" } };
  }
  const slug = await uniqueSlug(d.name);
  const project = await db.project.create({
    data: {
      name: d.name, slug, category: d.category, budget: new Prisma.Decimal(d.budget), description: d.description ?? null,
      startDate: d.startDate ? new Date(d.startDate) : null, deadline: d.deadline ? new Date(d.deadline) : null,
      managerId: d.managerId ?? null, status: ProjectStatus.PLANNING, isDemo: user.isDemo,
    },
    select: { id: true, slug: true },
  });
  await activity("project.created", `${user.name ?? "Someone"} created project ${d.name}`, user.id, project.id, user.isDemo);
  await audit.record({ actorId: user.id, action: "project.create", resourceType: "project", resourceId: project.id, metadata: { slug, category: d.category }, ...(await requestMeta()) });
  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true, slug: project.slug };
}

export async function updateProjectStatusAction(formData: FormData): Promise<ActionResult> {
  const user = await actor("project:update");
  if (denied(user)) return user;
  const parsed = updateProjectStatusSchema.safeParse(formObject(formData, ["projectId", "status"]));
  if (!parsed.success) return { error: "Invalid request." };
  const { projectId, status } = parsed.data;
  const project = await db.project.findFirst({ where: { id: projectId, ...demoFilter() }, select: { id: true, name: true, slug: true, status: true, isDemo: true } });
  if (!project) return { error: "Project not found." };
  if (project.status === status) return { ok: true };
  await db.project.update({ where: { id: projectId }, data: { status, completedAt: status === ProjectStatus.COMPLETED ? new Date() : null } });
  await recomputeProjectHealth(projectId);
  await activity("project.status_changed", `${user.name ?? "Someone"} moved ${project.name} from ${humanize(project.status)} to ${humanize(status)}`, user.id, projectId, project.isDemo);
  await audit.record({ actorId: user.id, action: "project.update", resourceType: "project", resourceId: projectId, metadata: { field: "status", from: project.status, to: status }, ...(await requestMeta()) });
  revalidatePath("/projects");
  revalidatePath(`/projects/${project.slug}`);
  revalidatePath("/");
  return { ok: true };
}

// ───────── Tasks ─────────

export async function createTaskAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await actor("task:create");
  if (denied(user)) return user;
  const parsed = createTaskSchema.safeParse(formObject(formData, ["projectId", "title", "priority", "assigneeId", "dueDate"]));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };
  const d = parsed.data;
  const project = await db.project.findFirst({ where: { id: d.projectId, ...demoFilter() }, select: { id: true, slug: true, isDemo: true } });
  if (!project) return { error: "Project not found." };
  if (d.assigneeId) {
    const exists = await db.user.findFirst({ where: { id: d.assigneeId, isActive: true }, select: { id: true } });
    if (!exists) return { error: "Check the highlighted fields.", fieldErrors: { assigneeId: "Unknown assignee" } };
  }
  const task = await db.task.create({ data: { projectId: project.id, title: d.title, priority: d.priority, assigneeId: d.assigneeId ?? null, dueDate: d.dueDate ? new Date(d.dueDate) : null, isDemo: project.isDemo }, select: { id: true } });
  await recomputeProjectHealth(project.id);
  await activity("task.created", `${user.name ?? "Someone"} added task "${d.title}"`, user.id, project.id, project.isDemo);
  await audit.record({ actorId: user.id, action: "task.create", resourceType: "task", resourceId: task.id, metadata: { projectId: project.id, priority: d.priority }, ...(await requestMeta()) });
  revalidatePath(`/projects/${project.slug}`);
  revalidatePath("/projects");
  return { ok: true };
}

export async function updateTaskStatusAction(formData: FormData): Promise<ActionResult> {
  const user = await actor("task:update");
  if (denied(user)) return user;
  const parsed = updateTaskStatusSchema.safeParse(formObject(formData, ["taskId", "status"]));
  if (!parsed.success) return { error: "Invalid request." };
  const { taskId, status } = parsed.data;
  const task = await db.task.findFirst({ where: { id: taskId, ...demoFilter() }, select: { id: true, title: true, status: true, isDemo: true, project: { select: { id: true, slug: true } } } });
  if (!task) return { error: "Task not found." };
  if (task.status === status) return { ok: true };
  await db.task.update({ where: { id: taskId }, data: { status, completedAt: status === TaskStatus.DONE ? new Date() : null } });
  await recomputeProjectHealth(task.project.id);
  await activity(status === TaskStatus.DONE ? "task.completed" : "task.status_changed", `${user.name ?? "Someone"} moved "${task.title}" to ${humanize(status)}`, user.id, task.project.id, task.isDemo);
  await audit.record({ actorId: user.id, action: "task.update", resourceType: "task", resourceId: taskId, metadata: { field: "status", from: task.status, to: status }, ...(await requestMeta()) });
  revalidatePath(`/projects/${task.project.slug}`);
  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true };
}

// ───────── Team ─────────

export async function addProjectMemberAction(formData: FormData): Promise<ActionResult> {
  const user = await actor("project:assign");
  if (denied(user)) return user;
  const parsed = addProjectMemberSchema.safeParse(formObject(formData, ["projectId", "userId", "role"]));
  if (!parsed.success) return { error: "Choose a person to add." };
  const { projectId, userId, role } = parsed.data;
  const [project, member] = await Promise.all([
    db.project.findFirst({ where: { id: projectId, ...demoFilter() }, select: { id: true, slug: true, isDemo: true } }),
    db.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true, name: true, title: true } }),
  ]);
  if (!project || !member) return { error: "Project or person not found." };
  const existing = await db.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } }, select: { userId: true } });
  if (existing) return { error: `${member.name ?? "That person"} is already on the team.` };
  await db.projectMember.create({ data: { projectId, userId, role: role ?? member.title ?? "Contributor" } });
  await activity("member.added", `${user.name ?? "Someone"} added ${member.name ?? "a team member"} to the project`, user.id, projectId, project.isDemo);
  await audit.record({ actorId: user.id, action: "project.assign", resourceType: "project", resourceId: projectId, metadata: { userId }, ...(await requestMeta()) });
  revalidatePath(`/projects/${project.slug}`);
  return { ok: true };
}

// ───────── Milestones ─────────

export async function completeMilestoneAction(formData: FormData): Promise<ActionResult> {
  const user = await actor("project:update");
  if (denied(user)) return user;
  const parsed = completeMilestoneSchema.safeParse(formObject(formData, ["milestoneId"]));
  if (!parsed.success) return { error: "Invalid request." };
  const m = await db.milestone.findFirst({ where: { id: parsed.data.milestoneId, ...demoFilter() }, select: { id: true, title: true, status: true, isDemo: true, project: { select: { id: true, slug: true } } } });
  if (!m) return { error: "Milestone not found." };
  if (m.status === MilestoneStatus.COMPLETED) return { ok: true };
  await db.milestone.update({ where: { id: m.id }, data: { status: MilestoneStatus.COMPLETED, completedAt: new Date() } });
  await recomputeProjectHealth(m.project.id);
  await activity("milestone.completed", `${user.name ?? "Someone"} marked milestone "${m.title}" complete`, user.id, m.project.id, m.isDemo);
  await audit.record({ actorId: user.id, action: "milestone.complete", resourceType: "milestone", resourceId: m.id, metadata: { from: m.status }, ...(await requestMeta()) });
  revalidatePath(`/projects/${m.project.slug}`);
  revalidatePath("/projects");
  revalidatePath("/");
  return { ok: true };
}
