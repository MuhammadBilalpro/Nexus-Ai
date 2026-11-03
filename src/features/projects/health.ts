import "server-only";
import { db } from "@/server/db";
import { ProjectStatus, ProjectHealth, TaskStatus, MilestoneStatus } from "@/generated/prisma/enums";

/**
 * Pure rule for a project's health, applied after every task or milestone
 * mutation so the stored `health` and `progress` columns stay consistent.
 *
 *  DELAYED  — deadline passed while ACTIVE, or any milestone MISSED
 *  AT_RISK  — more than 25% of open tasks are overdue
 *  ON_TRACK — otherwise
 */
export function computeHealth(input: { status: ProjectStatus; deadline: Date | null; openTasks: { dueDate: Date | null }[]; milestoneStatuses: MilestoneStatus[] }, now = new Date()): ProjectHealth {
  const pastDeadline = input.deadline !== null && input.deadline < now && input.status === ProjectStatus.ACTIVE;
  if (pastDeadline || input.milestoneStatuses.includes(MilestoneStatus.MISSED)) return ProjectHealth.DELAYED;
  const open = input.openTasks.length;
  if (open > 0) {
    const overdue = input.openTasks.filter((t) => t.dueDate && t.dueDate < now).length;
    if (overdue / open > 0.25) return ProjectHealth.AT_RISK;
  }
  return ProjectHealth.ON_TRACK;
}

/** Progress is done tasks over all tasks, 0–100; a project with no tasks keeps its stored value. */
export function computeProgress(counts: { done: number; total: number }): number | null {
  if (counts.total === 0) return null;
  return Math.round((counts.done / counts.total) * 100);
}

/** Recompute and persist health + progress for one project. */
export async function recomputeProjectHealth(projectId: string): Promise<{ health: ProjectHealth; progress: number } | null> {
  const p = await db.project.findUnique({
    where: { id: projectId },
    select: { status: true, deadline: true, progress: true, tasks: { select: { status: true, dueDate: true } }, milestones: { select: { status: true } } },
  });
  if (!p) return null;
  const openTasks = p.tasks.filter((t) => t.status !== TaskStatus.DONE);
  const done = p.tasks.length - openTasks.length;
  const health = p.status === ProjectStatus.COMPLETED || p.status === ProjectStatus.CANCELLED ? ProjectHealth.ON_TRACK : computeHealth({ status: p.status, deadline: p.deadline, openTasks, milestoneStatuses: p.milestones.map((m) => m.status) });
  const progress = p.status === ProjectStatus.COMPLETED ? 100 : (computeProgress({ done, total: p.tasks.length }) ?? p.progress);
  await db.project.update({ where: { id: projectId }, data: { health, progress } });
  return { health, progress };
}
