import "server-only";
import { cache } from "react";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { TaskStatus, type ProjectStatus, type ProjectCategory, type ProjectHealth, type TaskPriority, type MilestoneStatus } from "@/generated/prisma/enums";
import { money, sum, toFixed } from "@/server/finance/money";

const demoFilter = () => (env.DEMO_MODE ? {} : { isDemo: false });

// ───────── List ─────────

export interface ProjectListRow {
  id: string;
  name: string;
  slug: string;
  category: ProjectCategory;
  status: ProjectStatus;
  health: ProjectHealth;
  progress: number;
  budget: string;
  startDate: Date | null;
  deadline: Date | null;
  daysLeft: number | null;
  manager: { id: string; name: string | null } | null;
  client: string | null;
  openTasks: number;
  milestones: { id: string; title: string; dueDate: Date; status: MilestoneStatus }[];
}

export const SORT_KEYS = ["name", "category", "status", "health", "progress", "budget", "deadline", "manager", "openTasks"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const getProjects = cache(async (): Promise<ProjectListRow[]> => {
  const now = new Date();
  const rows = await db.project.findMany({
    where: demoFilter(),
    select: {
      id: true, name: true, slug: true, category: true, status: true, health: true, progress: true, budget: true, startDate: true, deadline: true,
      manager: { select: { id: true, name: true } },
      client: { select: { company: true, name: true } },
      _count: { select: { tasks: { where: { status: { not: TaskStatus.DONE } } } } },
      milestones: { select: { id: true, title: true, dueDate: true, status: true }, orderBy: { dueDate: "asc" } },
    },
    orderBy: [{ deadline: "asc" }, { name: "asc" }],
  });
  return rows.map((p) => ({
    id: p.id, name: p.name, slug: p.slug, category: p.category, status: p.status, health: p.health, progress: p.progress,
    budget: toFixed(money(p.budget)), startDate: p.startDate, deadline: p.deadline,
    daysLeft: p.deadline ? differenceInCalendarDays(p.deadline, now) : null,
    manager: p.manager, client: p.client?.company ?? p.client?.name ?? null, openTasks: p._count.tasks, milestones: p.milestones,
  }));
});

export function sortProjects(rows: ProjectListRow[], sort: SortKey, dir: "asc" | "desc"): ProjectListRow[] {
  const m = dir === "asc" ? 1 : -1;
  const str = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").localeCompare(b ?? "");
  const num = (a: number | null, b: number | null) => (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);
  const HEALTH_ORDER: Record<ProjectHealth, number> = { ON_TRACK: 0, AT_RISK: 1, DELAYED: 2 };
  const STATUS_ORDER: Record<ProjectStatus, number> = { PLANNING: 0, ACTIVE: 1, ON_HOLD: 2, COMPLETED: 3, CANCELLED: 4 };
  return [...rows].sort((a, b) => {
    switch (sort) {
      case "name": return m * str(a.name, b.name);
      case "category": return m * str(a.category, b.category);
      case "status": return m * (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      case "health": return m * (HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]);
      case "progress": return m * (a.progress - b.progress);
      case "budget": return m * (Number(a.budget) - Number(b.budget));
      case "deadline": return m * num(a.deadline?.getTime() ?? null, b.deadline?.getTime() ?? null);
      case "manager": return m * str(a.manager?.name, b.manager?.name);
      case "openTasks": return m * (a.openTasks - b.openTasks);
    }
  });
}

export interface UserOption {
  id: string;
  name: string;
  title: string | null;
}

export const getUserOptions = cache(async (): Promise<UserOption[]> => {
  const users = await db.user.findMany({ where: { ...demoFilter(), isActive: true }, select: { id: true, name: true, title: true }, orderBy: { name: "asc" } });
  return users.map((u) => ({ id: u.id, name: u.name ?? u.id, title: u.title }));
});

// ───────── Detail ─────────

export interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  overdue: boolean;
  assignee: { id: string; name: string | null } | null;
}

export interface MilestoneRow {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date;
  status: MilestoneStatus;
  completedAt: Date | null;
}

export interface MemberRow {
  userId: string;
  name: string;
  title: string | null;
  role: string;
  joinedAt: Date;
}

export interface ActivityItem {
  id: string;
  type: string;
  message: string;
  actor: string | null;
  createdAt: Date;
}

export interface ProjectDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: ProjectCategory;
  status: ProjectStatus;
  health: ProjectHealth;
  progress: number;
  budget: string;
  spent: string;
  spendPercent: number;
  startDate: Date | null;
  deadline: Date | null;
  daysLeft: number | null;
  completedAt: Date | null;
  manager: { id: string; name: string | null } | null;
  client: string | null;
  tasks: TaskRow[];
  milestones: MilestoneRow[];
  members: MemberRow[];
  activities: ActivityItem[];
}

export const getProjectBySlug = cache(async (slug: string): Promise<ProjectDetail | null> => {
  const now = new Date();
  const p = await db.project.findFirst({
    where: { ...demoFilter(), slug },
    select: {
      id: true, name: true, slug: true, description: true, category: true, status: true, health: true, progress: true, budget: true, startDate: true, deadline: true, completedAt: true,
      manager: { select: { id: true, name: true } },
      client: { select: { company: true, name: true } },
      expenses: { select: { amount: true } },
      tasks: { select: { id: true, title: true, status: true, priority: true, dueDate: true, assignee: { select: { id: true, name: true } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
      milestones: { select: { id: true, title: true, description: true, dueDate: true, status: true, completedAt: true }, orderBy: [{ order: "asc" }, { dueDate: "asc" }] },
      members: { select: { userId: true, role: true, joinedAt: true, user: { select: { name: true, title: true } } }, orderBy: { joinedAt: "asc" } },
      activities: { select: { id: true, type: true, message: true, createdAt: true, actor: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!p) return null;
  const spent = sum(p.expenses.map((e) => e.amount));
  const budget = money(p.budget);
  return {
    id: p.id, name: p.name, slug: p.slug, description: p.description, category: p.category, status: p.status, health: p.health, progress: p.progress,
    budget: toFixed(budget), spent: toFixed(spent), spendPercent: budget.isZero() ? 0 : Number(spent.div(budget).times(100).toFixed(0)),
    startDate: p.startDate, deadline: p.deadline, daysLeft: p.deadline ? differenceInCalendarDays(p.deadline, now) : null, completedAt: p.completedAt,
    manager: p.manager, client: p.client?.company ?? p.client?.name ?? null,
    tasks: p.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, overdue: t.status !== TaskStatus.DONE && !!t.dueDate && t.dueDate < now, assignee: t.assignee })),
    milestones: p.milestones,
    members: p.members.map((m) => ({ userId: m.userId, name: m.user.name ?? "Unnamed", title: m.user.title, role: m.role, joinedAt: m.joinedAt })),
    activities: p.activities.map((a) => ({ id: a.id, type: a.type, message: a.message, actor: a.actor?.name ?? null, createdAt: a.createdAt })),
  };
});
