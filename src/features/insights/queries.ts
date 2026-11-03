import "server-only";
import { cache } from "react";
import { addDays, differenceInCalendarDays, format, startOfMonth, startOfWeek, subDays, subWeeks } from "date-fns";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { ProjectStatus, ProjectHealth, ProjectCategory, TaskStatus, InvoiceStatus, ApprovalStatus, MilestoneStatus } from "@/generated/prisma/enums";
import { money, sum, subtract, toFixed, percentChange, marginPercent, type Money } from "@/server/finance/money";

/**
 * Business-intelligence read models. Every figure is an aggregate of
 * database records; money stays in Decimal until it is serialised as a
 * 2-dp string for the UI. Demo rows are included only in DEMO_MODE.
 */
const demoFilter = () => (env.DEMO_MODE ? {} : { isDemo: false });

const OPEN_TASK = { status: { not: TaskStatus.DONE } } as const;
const RECEIVABLE_STATUSES = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] as const;

// ───────── Revenue ─────────

export interface RevenueStats {
  monthRevenue: string;
  last30: { value: string; delta: number | null };
  outstanding: string;
  outstandingCount: number;
  overdue: string;
  overdueCount: number;
}

export const getRevenueStats = cache(async (): Promise<RevenueStats> => {
  const demo = demoFilter();
  const now = new Date();
  const d30 = subDays(now, 30);
  const d60 = subDays(now, 60);
  const [month, last30, prior30, outstanding, overdue] = await Promise.all([
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: InvoiceStatus.PAID, paidAt: { gte: startOfMonth(now), lte: now } } }),
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: InvoiceStatus.PAID, paidAt: { gte: d30, lte: now } } }),
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: InvoiceStatus.PAID, paidAt: { gte: d60, lt: d30 } } }),
    db.invoice.aggregate({ _sum: { amount: true }, _count: true, where: { ...demo, status: { in: [...RECEIVABLE_STATUSES] } } }),
    db.invoice.aggregate({ _sum: { amount: true }, _count: true, where: { ...demo, status: { in: [...RECEIVABLE_STATUSES] }, dueAt: { lt: now } } }),
  ]);
  const cur = money(last30._sum.amount);
  const prev = money(prior30._sum.amount);
  return {
    monthRevenue: toFixed(money(month._sum.amount)),
    last30: { value: toFixed(cur), delta: percentChange(cur, prev) },
    outstanding: toFixed(money(outstanding._sum.amount)),
    outstandingCount: outstanding._count,
    overdue: toFixed(money(overdue._sum.amount)),
    overdueCount: overdue._count,
  };
});

export interface RevenueByProject {
  projectId: string;
  name: string;
  slug: string;
  revenue: string;
}

export const getRevenueByProject = cache(async (limit = 8): Promise<RevenueByProject[]> => {
  const grouped = await db.invoice.groupBy({
    by: ["projectId"],
    _sum: { amount: true },
    where: { ...demoFilter(), status: InvoiceStatus.PAID, projectId: { not: null } },
  });
  const ids = grouped.map((g) => g.projectId).filter((id): id is string => Boolean(id));
  const projects = await db.project.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, slug: true } });
  const byId = new Map(projects.map((p) => [p.id, p]));
  return grouped
    .map((g) => ({ projectId: g.projectId as string, total: money(g._sum.amount) }))
    .sort((a, b) => b.total.comparedTo(a.total))
    .slice(0, limit)
    .map((g) => {
      const p = byId.get(g.projectId);
      return { projectId: g.projectId, name: p?.name ?? "Unassigned", slug: p?.slug ?? "", revenue: toFixed(g.total) };
    });
});

export interface ReceivableRow {
  id: string;
  number: string;
  client: string;
  project: string | null;
  projectSlug: string | null;
  amount: string;
  issuedAt: Date;
  dueAt: Date;
  status: InvoiceStatus;
  daysOverdue: number; // 0 when not overdue
}

export const getReceivables = cache(async (): Promise<ReceivableRow[]> => {
  const now = new Date();
  const rows = await db.invoice.findMany({
    where: { ...demoFilter(), status: { not: InvoiceStatus.CANCELLED } },
    select: { id: true, number: true, amount: true, issuedAt: true, dueAt: true, status: true, client: { select: { company: true, name: true } }, project: { select: { name: true, slug: true } } },
    orderBy: { dueAt: "desc" },
    take: 60,
  });
  const mapped = rows.map((r) => {
    const unpaid = r.status === InvoiceStatus.SENT || r.status === InvoiceStatus.OVERDUE;
    const late = unpaid && r.dueAt < now ? differenceInCalendarDays(now, r.dueAt) : 0;
    return {
      id: r.id, number: r.number, client: r.client?.company ?? r.client?.name ?? "—", project: r.project?.name ?? null, projectSlug: r.project?.slug ?? null,
      amount: toFixed(money(r.amount)), issuedAt: r.issuedAt, dueAt: r.dueAt,
      status: late > 0 ? InvoiceStatus.OVERDUE : r.status, daysOverdue: late,
    };
  });
  const rank = (s: InvoiceStatus) => (s === InvoiceStatus.OVERDUE ? 0 : s === InvoiceStatus.SENT ? 1 : s === InvoiceStatus.DRAFT ? 2 : 3);
  return mapped.sort((a, b) => rank(a.status) - rank(b.status) || b.daysOverdue - a.daysOverdue || b.dueAt.getTime() - a.dueAt.getTime());
});

// ───────── Profitability ─────────

export interface ProjectProfitRow {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  budget: string;
  invoiced: string;
  expenses: string;
  net: string;
  margin: number | null;
  spendPercent: number; // expenses / budget × 100 (0–100+)
}

export interface ProfitabilityData {
  grossMargin: number | null;
  totalRevenue: string;
  totalExpenses: string;
  netMonth: string;
  best: { name: string; slug: string; margin: number } | null;
  worst: { name: string; slug: string; margin: number } | null;
  rows: ProjectProfitRow[];
}

export const getProfitability = cache(async (): Promise<ProfitabilityData> => {
  const demo = demoFilter();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const [projects, revMonth, expMonth] = await Promise.all([
    db.project.findMany({
      where: { ...demo, status: { not: ProjectStatus.CANCELLED } },
      select: { id: true, name: true, slug: true, status: true, budget: true, invoices: { where: { status: InvoiceStatus.PAID }, select: { amount: true } }, expenses: { select: { amount: true } } },
      orderBy: { name: "asc" },
    }),
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: InvoiceStatus.PAID, paidAt: { gte: monthStart, lte: now } } }),
    db.expense.aggregate({ _sum: { amount: true }, where: { ...demo, incurredAt: { gte: monthStart, lte: now } } }),
  ]);

  let totalRevenue: Money = money(0);
  let totalExpenses: Money = money(0);
  const rows: ProjectProfitRow[] = projects.map((p) => {
    const invoiced = sum(p.invoices.map((i) => i.amount));
    const expenses = sum(p.expenses.map((e) => e.amount));
    const budget = money(p.budget);
    const net = subtract(invoiced, expenses);
    totalRevenue = totalRevenue.plus(invoiced);
    totalExpenses = totalExpenses.plus(expenses);
    return {
      id: p.id, name: p.name, slug: p.slug, status: p.status,
      budget: toFixed(budget), invoiced: toFixed(invoiced), expenses: toFixed(expenses), net: toFixed(net),
      margin: marginPercent(net, invoiced),
      spendPercent: budget.isZero() ? 0 : Number(expenses.div(budget).times(100).toFixed(0)),
    };
  });
  rows.sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity));
  const withMargin = rows.filter((r) => r.margin !== null) as (ProjectProfitRow & { margin: number })[];
  const pick = (r: (typeof withMargin)[number] | undefined) => (r ? { name: r.name, slug: r.slug, margin: r.margin } : null);
  return {
    grossMargin: marginPercent(subtract(totalRevenue, totalExpenses), totalRevenue),
    totalRevenue: toFixed(totalRevenue),
    totalExpenses: toFixed(totalExpenses),
    netMonth: toFixed(subtract(money(revMonth._sum.amount), money(expMonth._sum.amount))),
    best: pick(withMargin[0]),
    worst: pick(withMargin.length > 1 ? withMargin[withMargin.length - 1] : undefined),
    rows,
  };
});

// ───────── Projects performance ─────────

export interface ProjectPerformanceRow {
  id: string;
  name: string;
  slug: string;
  category: ProjectCategory;
  status: ProjectStatus;
  health: ProjectHealth;
  progress: number;
  deadline: Date | null;
  daysLeft: number | null; // negative when past
  openTasks: number;
  doneTasks: number;
  milestonesHit: number;
  milestonesMissed: number;
  manager: string | null;
}

export interface ProjectPerformanceData {
  rows: ProjectPerformanceRow[];
  onTrack: number;
  atRisk: number;
  delayed: number;
  averageProgress: number | null;
  weekly: { label: string; completed: number }[];
}

export const getProjectPerformance = cache(async (): Promise<ProjectPerformanceData> => {
  const demo = demoFilter();
  const now = new Date();
  const weekStart = startOfWeek(subWeeks(now, 7), { weekStartsOn: 1 });
  const [projects, doneTasks] = await Promise.all([
    db.project.findMany({
      where: { ...demo, status: { not: ProjectStatus.CANCELLED } },
      select: {
        id: true, name: true, slug: true, category: true, status: true, health: true, progress: true, deadline: true,
        manager: { select: { name: true } },
        tasks: { select: { status: true } },
        milestones: { select: { status: true } },
      },
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
    }),
    db.task.findMany({ where: { ...demo, status: TaskStatus.DONE, completedAt: { gte: weekStart } }, select: { completedAt: true } }),
  ]);

  const rows: ProjectPerformanceRow[] = projects.map((p) => ({
    id: p.id, name: p.name, slug: p.slug, category: p.category, status: p.status, health: p.health, progress: p.progress, deadline: p.deadline,
    daysLeft: p.deadline ? differenceInCalendarDays(p.deadline, now) : null,
    openTasks: p.tasks.filter((t) => t.status !== TaskStatus.DONE).length,
    doneTasks: p.tasks.filter((t) => t.status === TaskStatus.DONE).length,
    milestonesHit: p.milestones.filter((m) => m.status === MilestoneStatus.COMPLETED).length,
    milestonesMissed: p.milestones.filter((m) => m.status === MilestoneStatus.MISSED).length,
    manager: p.manager?.name ?? null,
  }));
  const live = rows.filter((r) => r.status === ProjectStatus.ACTIVE || r.status === ProjectStatus.ON_HOLD || r.status === ProjectStatus.PLANNING);
  const buckets = Array.from({ length: 8 }, (_, i) => startOfWeek(subWeeks(now, 7 - i), { weekStartsOn: 1 }));
  const weekly = buckets.map((start, i) => {
    const end = i + 1 < buckets.length ? buckets[i + 1]! : addDays(start, 7);
    return { label: format(start, "MMM d"), completed: doneTasks.filter((t) => t.completedAt && t.completedAt >= start && t.completedAt < end).length };
  });
  return {
    rows,
    onTrack: live.filter((r) => r.health === ProjectHealth.ON_TRACK).length,
    atRisk: live.filter((r) => r.health === ProjectHealth.AT_RISK).length,
    delayed: live.filter((r) => r.health === ProjectHealth.DELAYED).length,
    averageProgress: live.length ? Math.round(live.reduce((a, r) => a + r.progress, 0) / live.length) : null,
    weekly,
  };
});

// ───────── Workload ─────────

export interface WorkloadPerson {
  userId: string;
  name: string;
  title: string | null;
  department: string | null;
  open: number;
  inProgress: number;
  overdue: number;
  dueSoon: number;
}

export const getWorkload = cache(async (): Promise<WorkloadPerson[]> => {
  const now = new Date();
  const in7 = addDays(now, 7);
  const users = await db.user.findMany({
    where: { ...demoFilter(), isActive: true, tasks: { some: {} } },
    select: { id: true, name: true, title: true, department: { select: { name: true } }, tasks: { where: OPEN_TASK, select: { status: true, dueDate: true } } },
    take: 100,
  });
  return users
    .map((u) => ({
      userId: u.id, name: u.name ?? "Unnamed", title: u.title, department: u.department?.name ?? null,
      open: u.tasks.length,
      inProgress: u.tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      overdue: u.tasks.filter((t) => t.dueDate && t.dueDate < now).length,
      dueSoon: u.tasks.filter((t) => t.dueDate && t.dueDate >= now && t.dueDate <= in7).length,
    }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
});

// ───────── Clients ─────────

export interface ClientRow {
  id: string;
  company: string;
  contact: string;
  activeProjects: number;
  lifetime: string;
  outstanding: string;
  overdue: string;
  pendingApprovals: number;
  lastActivity: Date | null;
}

export const getClients = cache(async (): Promise<ClientRow[]> => {
  const now = new Date();
  const clients = await db.client.findMany({
    where: demoFilter(),
    select: {
      id: true, name: true, company: true,
      projects: { select: { id: true, status: true, activities: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } } },
      invoices: { where: { status: { not: InvoiceStatus.CANCELLED } }, select: { amount: true, status: true, dueAt: true, paidAt: true } },
      approvals: { where: { status: ApprovalStatus.PENDING }, select: { id: true } },
    },
    orderBy: { company: "asc" },
  });
  return clients
    .map((c) => {
      const paid = c.invoices.filter((i) => i.status === InvoiceStatus.PAID);
      const open = c.invoices.filter((i) => i.status === InvoiceStatus.SENT || i.status === InvoiceStatus.OVERDUE);
      const last = c.projects.flatMap((p) => p.activities.map((a) => a.createdAt)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
      return {
        id: c.id, company: c.company ?? c.name, contact: c.name,
        activeProjects: c.projects.filter((p) => p.status === ProjectStatus.ACTIVE).length,
        lifetime: toFixed(sum(paid.map((i) => i.amount))),
        outstanding: toFixed(sum(open.map((i) => i.amount))),
        overdue: toFixed(sum(open.filter((i) => i.dueAt < now).map((i) => i.amount))),
        pendingApprovals: c.approvals.length,
        lastActivity: last,
      };
    })
    .sort((a, b) => Number(b.lifetime) - Number(a.lifetime));
});

// ───────── Opportunities (rule-derived signals) ─────────

export type SignalKind = "phase2" | "expand" | "case-study" | "idle-capability";

export interface Signal {
  id: string;
  kind: SignalKind;
  title: string;
  detail: string;
  facts: { label: string; value: string; href?: string }[];
  prompt: string; // sent to the assistant
}

export const getOpportunitySignals = cache(async (): Promise<Signal[]> => {
  const demo = demoFilter();
  const now = new Date();
  const [completed, clients, nearDone, activeCategories] = await Promise.all([
    db.project.findMany({
      where: { ...demo, status: ProjectStatus.COMPLETED, completedAt: { gte: subDays(now, 90) } },
      select: { id: true, name: true, slug: true, completedAt: true, category: true, clientId: true, client: { select: { company: true, name: true, projects: { where: { status: { in: [ProjectStatus.PLANNING, ProjectStatus.ACTIVE] } }, select: { id: true, createdAt: true } } } } },
    }),
    db.client.findMany({
      where: { ...demo, invoices: { some: { status: InvoiceStatus.PAID } } },
      select: { id: true, name: true, company: true, invoices: { where: { status: { in: [InvoiceStatus.PAID, InvoiceStatus.SENT, InvoiceStatus.OVERDUE] } }, select: { status: true, dueAt: true, paidAt: true, amount: true } }, projects: { where: { status: ProjectStatus.ACTIVE }, select: { id: true } } },
    }),
    db.project.findMany({ where: { ...demo, status: ProjectStatus.ACTIVE, progress: { gte: 80 } }, select: { id: true, name: true, slug: true, progress: true, deadline: true, client: { select: { company: true, name: true } } } }),
    db.project.findMany({ where: { ...demo, status: { in: [ProjectStatus.ACTIVE, ProjectStatus.PLANNING] } }, select: { category: true }, distinct: ["category"] }),
  ]);

  const signals: Signal[] = [];

  for (const p of completed) {
    const followOn = p.client?.projects.some((q) => q.id !== p.id && p.completedAt && q.createdAt >= subDays(p.completedAt, 14)) ?? false;
    if (followOn) continue;
    const clientName = p.client?.company ?? p.client?.name ?? "the client";
    signals.push({
      id: `phase2-${p.id}`,
      kind: "phase2",
      title: `Propose a phase 2 for ${p.name}`,
      detail: `Delivered ${p.completedAt ? format(p.completedAt, "MMM d") : "recently"} for ${clientName}; no follow-on project has been created since.`,
      facts: [
        { label: "Completed", value: p.completedAt ? format(p.completedAt, "MMM d, yyyy") : "—", href: `/projects/${p.slug}` },
        { label: "Client", value: clientName, href: "/insights?view=clients" },
        { label: "Follow-on projects", value: "none" },
      ],
      prompt: `Draft a phase 2 proposal for ${p.name} (${clientName}) based on what we delivered.`,
    });
  }

  for (const c of clients) {
    const settled = c.invoices.filter((i) => i.status === InvoiceStatus.PAID);
    const late = c.invoices.filter((i) => (i.status === InvoiceStatus.PAID && i.paidAt && i.paidAt > i.dueAt) || ((i.status === InvoiceStatus.SENT || i.status === InvoiceStatus.OVERDUE) && i.dueAt < now));
    if (settled.length < 2 || late.length > 0) continue;
    const name = c.company ?? c.name;
    signals.push({
      id: `expand-${c.id}`,
      kind: "expand",
      title: `Expand the relationship with ${name}`,
      detail: `${settled.length} invoices, every one paid on or before its due date. A reliable payer is the lowest-risk account to grow.`,
      facts: [
        { label: "Invoices paid on time", value: `${settled.length} of ${settled.length}`, href: "/insights?view=clients" },
        { label: "Lifetime revenue", value: toFixed(sum(settled.map((i) => i.amount))) + " USD" },
        { label: "Active projects", value: String(c.projects.length) },
      ],
      prompt: `Suggest expansion offers for ${name}, a client who has paid every invoice on time.`,
    });
  }

  for (const p of nearDone) {
    signals.push({
      id: `case-${p.id}`,
      kind: "case-study",
      title: `Prepare a case study for ${p.name}`,
      detail: `At ${p.progress}% progress${p.deadline ? `, due ${format(p.deadline, "MMM d")}` : ""}. Collect results and client quotes now so the story is ready at hand-over.`,
      facts: [
        { label: "Progress", value: `${p.progress}%`, href: `/projects/${p.slug}` },
        { label: "Client", value: p.client?.company ?? p.client?.name ?? "Internal" },
      ],
      prompt: `Outline a case study for ${p.name}: problem, approach, results.`,
    });
  }

  const active = new Set(activeCategories.map((c) => c.category));
  for (const cat of Object.values(ProjectCategory)) {
    if (active.has(cat)) continue;
    const label = cat === ProjectCategory.UI_UX_DESIGN ? "UI/UX Design" : cat.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
    signals.push({
      id: `idle-${cat}`,
      kind: "idle-capability",
      title: `${label} capability is idle`,
      detail: `No active or planned project in this category. Either pipeline work is needed or the capacity can be redeployed.`,
      facts: [{ label: "Active projects", value: "0", href: "/projects?view=table" }],
      prompt: `Which of our clients could use ${label} work? Draft an outreach note.`,
    });
  }

  return signals;
});
