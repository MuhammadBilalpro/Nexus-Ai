import type { BadgeTone } from "@/components/ui/badge";
import type { ProjectHealth, ProjectStatus, TaskPriority, TaskStatus, MilestoneStatus } from "@/generated/prisma/enums";

export const HEALTH_TONE: Record<ProjectHealth, BadgeTone> = { ON_TRACK: "success", AT_RISK: "warning", DELAYED: "danger" };
export const STATUS_TONE: Record<ProjectStatus, BadgeTone> = { PLANNING: "neutral", ACTIVE: "accent", ON_HOLD: "warning", COMPLETED: "success", CANCELLED: "outline" };
export const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = { LOW: "neutral", MEDIUM: "outline", HIGH: "warning", CRITICAL: "danger" };
export const TASK_STATUS_TONE: Record<TaskStatus, BadgeTone> = { TODO: "neutral", IN_PROGRESS: "accent", IN_REVIEW: "warning", DONE: "success" };
export const MILESTONE_TONE: Record<MilestoneStatus, BadgeTone> = { PLANNED: "neutral", IN_PROGRESS: "accent", COMPLETED: "success", MISSED: "danger" };

export const PROGRESS_TONE: Record<ProjectHealth, "default" | "warning" | "danger"> = { ON_TRACK: "default", AT_RISK: "warning", DELAYED: "danger" };

export function daysLabel(days: number | null, completed = false): string {
  if (completed) return "delivered";
  if (days === null) return "no deadline";
  if (days === 0) return "due today";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `${days}d left`;
}
