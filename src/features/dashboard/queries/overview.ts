import "server-only";
import { cache } from "react";
import { addDays, startOfMonth, subMonths, format } from "date-fns";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { Prisma } from "@/generated/prisma/client";
import { ProjectStatus, ProjectHealth, TaskStatus, InvoiceStatus, ApprovalStatus } from "@/generated/prisma/enums";
import { money, sum, subtract, toFixed, percentChange, marginPercent } from "@/server/finance/money";
import { periodRange, type Period, type PeriodRange } from "../period";

/**
 * Dashboard read models. All figures come from database records.
 * Demo rows (isDemo = true) are only included while DEMO_MODE is on.
 */
const demoFilter = () => (env.DEMO_MODE ? {} : { isDemo: false });

export interface KpiValue {
  value: string; // formatted-ready raw (decimal string or integer string)
  delta: number | null; // % change vs previous period, null when no baseline
}

export interface OverviewKpis {
  activeProjects: number;
  completedProjects: number; // completed within period
  delayedProjects: number;
  totalRevenue: string; // all-time paid revenue
  periodRevenue: KpiValue; // paid within period
  periodExpenses: KpiValue;
  periodProfit: { value: string; margin: number | null };
  productivity: { completedTasks: number; totalTasksDue: number; percent: number | null };
  pendingApprovals: number;
  upcomingDeadlines: number; // tasks + projects due in next 7 days
}

export const getOverviewKpis = cache(async (period: Period): Promise<OverviewKpis> => {
  const r = periodRange(period);
  const demo = demoFilter();
  const in7 = addDays(new Date(), 7);

  const [
    activeProjects,
    completedProjects,
    delayedProjects,
    totalRevenueAgg,
    periodRevenueAgg,
    prevRevenueAgg,
    periodExpenseAgg,
    prevExpenseAgg,
    completedTasks,
    totalTasksDue,
    pendingApprovals,
    upcomingTasks,
    upcomingProjects,
  ] = await Promise.all([
    db.project.count({ where: { ...demo, status: ProjectStatus.ACTIVE } }),
    db.project.count({ where: { ...demo, status: ProjectStatus.COMPLETED, completedAt: { gte: r.start, lte: r.end } } }),
    db.project.count({
      where: {
        ...demo,
        status: { in: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD] },
        OR: [{ health: ProjectHealth.DELAYED }, { deadline: { lt: new Date() } }],
      },
    }),
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: InvoiceStatus.PAID } }),
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: InvoiceStatus.PAID, paidAt: { gte: r.start, lte: r.end } } }),
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: InvoiceStatus.PAID, paidAt: { gte: r.prevStart, lt: r.prevEnd } } }),
    db.expense.aggregate({ _sum: { amount: true }, where: { ...demo, incurredAt: { gte: r.start, lte: r.end } } }),
    db.expense.aggregate({ _sum: { amount: true }, where: { ...demo, incurredAt: { gte: r.prevStart, lt: r.prevEnd } } }),
    db.task.count({ where: { ...demo, status: TaskStatus.DONE, completedAt: { gte: r.start, lte: r.end } } }),
    db.task.count({ where: { ...demo, OR: [{ dueDate: { gte: r.start, lte: r.end } }, { completedAt: { gte: r.start, lte: r.end } }] } }),
    db.clientApproval.count({ where: { ...demo, status: ApprovalStatus.PENDING } }),
    db.task.count({ where: { ...demo, status: { not: TaskStatus.DONE }, dueDate: { gte: new Date(), lte: in7 } } }),
    db.project.count({ where: { ...demo, status: ProjectStatus.ACTIVE, deadline: { gte: new Date(), lte: in7 } } }),
  ]);

  const periodRevenue = money(periodRevenueAgg._sum.amount);
  const prevRevenue = money(prevRevenueAgg._sum.amount);
  const periodExpenses = money(periodExpenseAgg._sum.amount);
  const prevExpenses = money(prevExpenseAgg._sum.amount);
  const profit = subtract(periodRevenue, periodExpenses);

  return {
    activeProjects,
    completedProjects,
    delayedProjects,
    totalRevenue: toFixed(money(totalRevenueAgg._sum.amount)),
    periodRevenue: { value: toFixed(periodRevenue), delta: percentChange(periodRevenue, prevRevenue) },
    periodExpenses: { value: toFixed(periodExpenses), delta: percentChange(periodExpenses, prevExpenses) },
    periodProfit: { value: toFixed(profit), margin: marginPercent(profit, periodRevenue) },
    productivity: {
      completedTasks,
      totalTasksDue,
      percent: totalTasksDue === 0 ? null : Math.round((completedTasks / totalTasksDue) * 100),
    },
    pendingApprovals,
    upcomingDeadlines: upcomingTasks + upcomingProjects,
  };
});

// ───────── Revenue trend (last 12 months, grouped in SQL) ─────────

export interface RevenuePoint {
  month: string; // "Jan"
  key: string; // "2026-01"
  revenue: string;
  expenses: string;
}

export const getRevenueTrend = cache(async (): Promise<RevenuePoint[]> => {
  const from = startOfMonth(subMonths(new Date(), 11));
  const demoSql = env.DEMO_MODE ? Prisma.empty : Prisma.sql`AND "isDemo" = false`;

  const [rev, exp] = await Promise.all([
    db.$queryRaw<{ month: Date; total: Prisma.Decimal }[]>`
      SELECT date_trunc('month', "paidAt") AS month, SUM("amount") AS total
      FROM "Invoice"
      WHERE "status" = 'PAID' AND "paidAt" >= ${from} ${demoSql}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ month: Date; total: Prisma.Decimal }[]>`
      SELECT date_trunc('month', "incurredAt") AS month, SUM("amount") AS total
      FROM "Expense"
      WHERE "incurredAt" >= ${from} ${demoSql}
      GROUP BY 1 ORDER BY 1`,
  ]);

  const revMap = new Map(rev.map((r) => [format(r.month, "yyyy-MM"), money(r.total)]));
  const expMap = new Map(exp.map((r) => [format(r.month, "yyyy-MM"), money(r.total)]));

  return Array.from({ length: 12 }, (_, i) => {
    const d = startOfMonth(subMonths(new Date(), 11 - i));
    const key = format(d, "yyyy-MM");
    return { key, month: format(d, "MMM"), revenue: toFixed(revMap.get(key) ?? money(0)), expenses: toFixed(expMap.get(key) ?? money(0)) };
  });
});

// ───────── Project health list ─────────

export interface ProjectHealthRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  status: ProjectStatus;
  health: ProjectHealth;
  progress: number;
  deadline: Date | null;
  overdue: boolean;
  budget: string;
  spent: string;
  manager: string | null;
  openTasks: number;
}

export const getProjectHealth = cache(async (limit = 8): Promise<ProjectHealthRow[]> => {
  const projects = await db.project.findMany({
    where: { ...demoFilter(), status: { in: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.PLANNING] } },
    select: {
      id: true, name: true, slug: true, category: true, status: true, health: true, progress: true, deadline: true, budget: true,
      manager: { select: { name: true } },
      expenses: { select: { amount: true } },
      _count: { select: { tasks: { where: { status: { not: TaskStatus.DONE } } } } },
    },
    orderBy: [{ health: "desc" }, { deadline: "asc" }],
    take: limit,
  });
  const now = Date.now();
  return projects.map((p) => ({
    id: p.id, name: p.name, slug: p.slug, category: p.category, status: p.status, health: p.health, progress: p.progress,
    deadline: p.deadline, overdue: p.deadline ? p.deadline.getTime() < now : false, budget: toFixed(money(p.budget)), spent: toFixed(sum(p.expenses.map((e) => e.amount))),
    manager: p.manager?.name ?? null, openTasks: p._count.tasks,
  }));
});

// ───────── Team workload ─────────

export interface WorkloadRow {
  userId: string;
  name: string;
  title: string | null;
  inProgress: number;
  overdue: number;
  total: number;
}

export const getTeamWorkload = cache(async (limit = 8): Promise<WorkloadRow[]> => {
  const users = await db.user.findMany({
    where: { ...demoFilter(), isActive: true, tasks: { some: { status: { not: TaskStatus.DONE } } } },
    select: {
      id: true, name: true, title: true,
      tasks: { where: { status: { not: TaskStatus.DONE } }, select: { status: true, dueDate: true } },
    },
    take: 50,
  });
  const now = Date.now();
  return users
    .map((u) => ({
      userId: u.id, name: u.name ?? "Unnamed", title: u.title,
      inProgress: u.tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      overdue: u.tasks.filter((t) => t.dueDate && t.dueDate.getTime() < now).length,
      total: u.tasks.length,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
});

// ───────── Activity, deadlines, alerts ─────────

export interface ActivityRow {
  id: string;
  type: string;
  message: string;
  actor: string | null;
  project: string | null;
  createdAt: Date;
}

export const getRecentActivity = cache(async (limit = 8): Promise<ActivityRow[]> => {
  const rows = await db.activity.findMany({
    where: demoFilter(),
    select: { id: true, type: true, message: true, createdAt: true, actor: { select: { name: true } }, project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({ id: r.id, type: r.type, message: r.message, actor: r.actor?.name ?? null, project: r.project?.name ?? null, createdAt: r.createdAt }));
});

export interface DeadlineRow {
  id: string;
  kind: "task" | "project";
  title: string;
  project: string;
  dueDate: Date;
  priority: string | null;
  assignee: string | null;
  overdue: boolean;
}

export const getUpcomingDeadlines = cache(async (limit = 8): Promise<DeadlineRow[]> => {
  const horizon = addDays(new Date(), 14);
  const [tasks, projects] = await Promise.all([
    db.task.findMany({
      where: { ...demoFilter(), status: { not: TaskStatus.DONE }, dueDate: { lte: horizon } },
      select: { id: true, title: true, dueDate: true, priority: true, project: { select: { name: true } }, assignee: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: limit,
    }),
    db.project.findMany({
      where: { ...demoFilter(), status: ProjectStatus.ACTIVE, deadline: { lte: horizon } },
      select: { id: true, name: true, deadline: true },
      orderBy: { deadline: "asc" },
      take: limit,
    }),
  ]);
  const now = Date.now();
  const rows: DeadlineRow[] = [
    ...tasks.filter((t) => t.dueDate).map((t) => ({ id: t.id, kind: "task" as const, title: t.title, project: t.project.name, dueDate: t.dueDate as Date, priority: t.priority, assignee: t.assignee?.name ?? null, overdue: (t.dueDate as Date).getTime() < now })),
    ...projects.filter((p) => p.deadline).map((p) => ({ id: p.id, kind: "project" as const, title: `${p.name} — delivery`, project: p.name, dueDate: p.deadline as Date, priority: null, assignee: null, overdue: (p.deadline as Date).getTime() < now })),
  ];
  return rows.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()).slice(0, limit);
});

export interface AlertRow {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
}

/** Deterministic, rule-based alerts derived from records. (AI insights arrive in Phase 3.) */
export const getCriticalAlerts = cache(async (): Promise<AlertRow[]> => {
  const demo = demoFilter();
  const [overdueInvoices, delayed, overBudget, pendingOld] = await Promise.all([
    db.invoice.findMany({ where: { ...demo, status: { in: [InvoiceStatus.OVERDUE, InvoiceStatus.SENT] }, dueAt: { lt: new Date() } }, select: { number: true, amount: true, client: { select: { company: true, name: true } } }, take: 5 }),
    db.project.findMany({ where: { ...demo, status: ProjectStatus.ACTIVE, OR: [{ health: ProjectHealth.DELAYED }, { deadline: { lt: new Date() } }] }, select: { id: true, name: true, deadline: true }, take: 5 }),
    db.project.findMany({ where: { ...demo, status: { in: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD] } }, select: { id: true, name: true, budget: true, expenses: { select: { amount: true } } } }),
    db.clientApproval.findMany({ where: { ...demo, status: ApprovalStatus.PENDING, requestedAt: { lt: addDays(new Date(), -7) } }, select: { id: true, title: true, project: { select: { name: true } } }, take: 5 }),
  ]);
  const alerts: AlertRow[] = [];
  for (const inv of overdueInvoices) {
    alerts.push({ id: `inv-${inv.number}`, severity: "critical", title: `Invoice ${inv.number} is overdue`, detail: `${inv.client?.company ?? inv.client?.name ?? "Client"} · ${toFixed(money(inv.amount))} USD outstanding` });
  }
  for (const p of delayed) {
    alerts.push({ id: `delay-${p.id}`, severity: "critical", title: `${p.name} is behind schedule`, detail: p.deadline ? `Deadline ${format(p.deadline, "MMM d")}` : "No deadline set" });
  }
  for (const p of overBudget) {
    const spent = sum(p.expenses.map((e) => e.amount));
    const budget = money(p.budget);
    if (!budget.isZero() && spent.div(budget).gte(0.8)) {
      const pct = Number(spent.div(budget).times(100).toFixed(0));
      alerts.push({ id: `budget-${p.id}`, severity: pct >= 100 ? "critical" : "warning", title: `${p.name} at ${pct}% of budget`, detail: `${toFixed(spent)} of ${toFixed(budget)} USD spent` });
    }
  }
  for (const a of pendingOld) {
    alerts.push({ id: `appr-${a.id}`, severity: "warning", title: `Approval waiting over a week`, detail: `${a.title} · ${a.project.name}` });
  }
  return alerts.slice(0, 8);
});

export type { PeriodRange };
