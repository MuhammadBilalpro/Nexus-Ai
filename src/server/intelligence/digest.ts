import "server-only";
import { cache } from "react";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { ProjectStatus, ProjectHealth, TaskStatus, InvoiceStatus, ApprovalStatus, ActionStatus } from "@/generated/prisma/enums";
import { money, sum, toFixed } from "@/server/finance/money";
import { formatMoney } from "@/lib/format";

/**
 * Today's Intelligence — a deterministic digest computed from records.
 *
 * Every item carries the facts it was derived from so the UI can show its
 * provenance. This is the rule layer the Executive Intelligence agent builds
 * on; the LLM narration layer arrives in Phase 3 and will cite these same facts.
 */
export type Severity = "critical" | "warning" | "positive" | "info";

export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  /** Verified facts behind the conclusion, each with a record reference. */
  facts: { label: string; value: string; href?: string }[];
  href?: string;
  /** Suggested question to continue in the assistant. */
  followUp?: string;
}

const demoFilter = () => (env.DEMO_MODE ? {} : { isDemo: false });

export const getTodaysIntelligence = cache(async (): Promise<Insight[]> => {
  const demo = demoFilter();
  const now = new Date();
  const in7 = addDays(now, 7);

  const [delayedProjects, overdueInvoices, overloaded, pendingApprovals, pendingActions, dueSoon, budgetRisk, recentWins] = await Promise.all([
    db.project.findMany({ where: { ...demo, status: ProjectStatus.ACTIVE, OR: [{ health: ProjectHealth.DELAYED }, { deadline: { lt: now } }] }, select: { id: true, slug: true, name: true, deadline: true, progress: true, _count: { select: { tasks: { where: { status: { not: TaskStatus.DONE } } } } } } }),
    db.invoice.findMany({ where: { ...demo, status: { in: [InvoiceStatus.OVERDUE, InvoiceStatus.SENT] }, dueAt: { lt: now } }, select: { id: true, number: true, amount: true, dueAt: true, client: { select: { company: true, name: true } } }, orderBy: { dueAt: "asc" } }),
    db.user.findMany({ where: { ...demo, isActive: true }, select: { id: true, name: true, tasks: { where: { status: { not: TaskStatus.DONE } }, select: { dueDate: true } } } }),
    db.clientApproval.findMany({ where: { ...demo, status: ApprovalStatus.PENDING }, select: { id: true, title: true, requestedAt: true, project: { select: { name: true, slug: true } } }, orderBy: { requestedAt: "asc" } }),
    db.proposedAction.count({ where: { ...demo, status: ActionStatus.PENDING } }),
    db.milestone.findMany({ where: { ...demo, status: { in: ["PLANNED", "IN_PROGRESS"] }, dueDate: { gte: now, lte: in7 } }, select: { title: true, dueDate: true, project: { select: { name: true, slug: true } } } }),
    db.project.findMany({ where: { ...demo, status: ProjectStatus.ACTIVE }, select: { id: true, slug: true, name: true, budget: true, progress: true, expenses: { select: { amount: true } } } }),
    db.project.findMany({ where: { ...demo, status: ProjectStatus.COMPLETED, completedAt: { gte: addDays(now, -45) } }, select: { name: true, slug: true, completedAt: true, invoices: { where: { status: InvoiceStatus.PAID }, select: { amount: true } } } }),
  ]);

  const insights: Insight[] = [];

  for (const p of delayedProjects) {
    const daysLate = p.deadline ? differenceInCalendarDays(now, p.deadline) : 0;
    insights.push({
      id: `delay-${p.id}`,
      severity: "critical",
      title: `${p.name} is ${daysLate > 0 ? `${daysLate} days past its deadline` : "flagged as delayed"}`,
      detail: `Progress sits at ${p.progress}% with ${p._count.tasks} open tasks. A re-baselined plan or scope decision is needed to protect the client relationship.`,
      facts: [
        { label: "Deadline", value: p.deadline ? format(p.deadline, "MMM d, yyyy") : "—", href: `/projects/${p.slug}` },
        { label: "Progress", value: `${p.progress}%` },
        { label: "Open tasks", value: String(p._count.tasks) },
      ],
      href: `/projects/${p.slug}`,
      followUp: `What is blocking ${p.name}?`,
    });
  }

  if (overdueInvoices.length > 0) {
    const total = sum(overdueInvoices.map((i) => i.amount));
    const oldest = overdueInvoices[0]!;
    insights.push({
      id: "overdue-invoices",
      severity: "critical",
      title: `${formatMoney(toFixed(total))} outstanding across ${overdueInvoices.length} overdue ${overdueInvoices.length === 1 ? "invoice" : "invoices"}`,
      detail: `The oldest, ${oldest.number} for ${oldest.client?.company ?? oldest.client?.name ?? "a client"}, is ${differenceInCalendarDays(now, oldest.dueAt)} days late. The Finance agent has reminders ready for approval.`,
      facts: overdueInvoices.slice(0, 4).map((i) => ({ label: i.number, value: `${formatMoney(toFixed(money(i.amount)))} · ${differenceInCalendarDays(now, i.dueAt)}d late`, href: "/insights?view=revenue" })),
      href: "/insights?view=revenue",
      followUp: "Which clients have pending payments?",
    });
  }

  const heavy = overloaded.map((u) => ({ name: u.name ?? "Unnamed", open: u.tasks.length, overdue: u.tasks.filter((t) => t.dueDate && t.dueDate < now).length })).filter((u) => u.open >= 8).sort((a, b) => b.open - a.open);
  if (heavy.length > 0) {
    const top = heavy[0]!;
    insights.push({
      id: "workload",
      severity: "warning",
      title: `${top.name} is carrying ${top.open} open tasks${top.overdue ? `, ${top.overdue} overdue` : ""}`,
      detail: `${heavy.length === 1 ? "One person is" : `${heavy.length} people are`} above the 8-task threshold. Rebalancing now avoids the slip compounding into next week's milestones.`,
      facts: heavy.slice(0, 3).map((u) => ({ label: u.name, value: `${u.open} open · ${u.overdue} overdue`, href: "/insights?view=workload" })),
      href: "/insights?view=workload",
      followUp: "Which team members are overloaded?",
    });
  }

  for (const p of budgetRisk) {
    const spent = sum(p.expenses.map((e) => e.amount));
    const budget = money(p.budget);
    if (budget.isZero()) continue;
    const pct = Number(spent.div(budget).times(100).toFixed(0));
    if (pct >= 80 || (pct > p.progress + 25 && pct >= 40)) {
      insights.push({
        id: `budget-${p.id}`,
        severity: pct >= 100 ? "critical" : "warning",
        title: `${p.name} has used ${pct}% of budget at ${p.progress}% progress`,
        detail: pct >= 100 ? "Spending has exceeded the approved budget." : "Spend is running ahead of delivery; margin on this project is at risk unless scope or cost is corrected.",
        facts: [
          { label: "Budget", value: formatMoney(toFixed(budget)), href: `/projects/${p.slug}` },
          { label: "Spent", value: formatMoney(toFixed(spent)) },
          { label: "Progress", value: `${p.progress}%` },
        ],
        href: `/projects/${p.slug}`,
      });
    }
  }

  const stale = pendingApprovals.filter((a) => differenceInCalendarDays(now, a.requestedAt) >= 7);
  if (pendingApprovals.length > 0) {
    insights.push({
      id: "approvals",
      severity: stale.length > 0 ? "warning" : "info",
      title: `${pendingApprovals.length} client ${pendingApprovals.length === 1 ? "approval" : "approvals"} waiting${stale.length ? `, ${stale.length} for over a week` : ""}`,
      detail: stale.length ? `“${stale[0]!.title}” on ${stale[0]!.project.name} has waited ${differenceInCalendarDays(now, stale[0]!.requestedAt)} days. Delivery cannot proceed until it is resolved.` : "All approvals are within the normal response window.",
      facts: pendingApprovals.slice(0, 3).map((a) => ({ label: a.project.name, value: `${a.title} · ${differenceInCalendarDays(now, a.requestedAt)}d`, href: `/projects/${a.project.slug}` })),
      href: "/projects",
    });
  }

  if (dueSoon.length > 0) {
    insights.push({
      id: "milestones",
      severity: "info",
      title: `${dueSoon.length} ${dueSoon.length === 1 ? "milestone is" : "milestones are"} due in the next 7 days`,
      detail: dueSoon.map((m) => `${m.project.name}: ${m.title} (${format(m.dueDate, "EEE d")})`).join(" · "),
      facts: dueSoon.slice(0, 4).map((m) => ({ label: m.project.name, value: `${m.title} · ${format(m.dueDate, "MMM d")}`, href: `/projects/${m.project.slug}` })),
      href: "/projects?view=timeline",
    });
  }

  for (const p of recentWins) {
    insights.push({
      id: `win-${p.slug}`,
      severity: "positive",
      title: `${p.name} delivered${p.invoices.length ? ` with ${formatMoney(toFixed(sum(p.invoices.map((i) => i.amount))))} collected` : ""}`,
      detail: `Completed ${p.completedAt ? format(p.completedAt, "MMM d") : "recently"}. A good moment for a case study and a follow-on proposal.`,
      facts: [{ label: "Completed", value: p.completedAt ? format(p.completedAt, "MMM d, yyyy") : "—", href: `/projects/${p.slug}` }],
      href: `/projects/${p.slug}`,
    });
  }

  if (pendingActions > 0) {
    insights.push({
      id: "actions",
      severity: "info",
      title: `${pendingActions} agent ${pendingActions === 1 ? "action is" : "actions are"} waiting for your decision`,
      detail: "Nothing executes without approval. Review the rationale and approve or reject each one.",
      facts: [{ label: "Pending", value: String(pendingActions), href: "/agents?tab=approvals" }],
      href: "/agents?tab=approvals",
    });
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2, positive: 3 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]);
});

/** 0–100 composite with the components that produced it. */
export interface HealthScore {
  score: number;
  label: "Excellent" | "Healthy" | "Needs attention" | "At risk";
  components: { label: string; score: number; weight: number; note: string }[];
}

export const getCompanyHealth = cache(async (): Promise<HealthScore> => {
  const demo = demoFilter();
  const now = new Date();
  const monthAgo = addDays(now, -30);
  const [projects, overdueInv, sentInv, people, revenue, expenses] = await Promise.all([
    db.project.findMany({ where: { ...demo, status: ProjectStatus.ACTIVE }, select: { health: true, deadline: true } }),
    db.invoice.count({ where: { ...demo, status: { in: [InvoiceStatus.OVERDUE, InvoiceStatus.SENT] }, dueAt: { lt: now } } }),
    db.invoice.count({ where: { ...demo, status: { in: [InvoiceStatus.OVERDUE, InvoiceStatus.SENT, InvoiceStatus.PAID] }, issuedAt: { gte: addDays(now, -120) } } }),
    db.user.findMany({ where: { ...demo, isActive: true, tasks: { some: {} } }, select: { tasks: { where: { status: { not: TaskStatus.DONE } }, select: { id: true } } } }),
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: InvoiceStatus.PAID, paidAt: { gte: monthAgo } } }),
    db.expense.aggregate({ _sum: { amount: true }, where: { ...demo, incurredAt: { gte: monthAgo } } }),
  ]);

  const onTrack = projects.filter((p) => p.health === ProjectHealth.ON_TRACK && (!p.deadline || p.deadline >= now)).length;
  const delivery = projects.length ? Math.round((onTrack / projects.length) * 100) : 100;
  const collections = sentInv ? Math.round(((sentInv - overdueInv) / sentInv) * 100) : 100;
  const overloaded = people.filter((p) => p.tasks.length >= 8).length;
  const capacity = people.length ? Math.round(((people.length - overloaded) / people.length) * 100) : 100;
  const rev = money(revenue._sum.amount);
  const exp = money(expenses._sum.amount);
  const margin = rev.isZero() ? 0 : Number(rev.minus(exp).div(rev).times(100).toFixed(0));
  const profitability = Math.max(0, Math.min(100, Math.round(50 + margin)));

  const components = [
    { label: "Delivery", score: delivery, weight: 0.35, note: `${onTrack} of ${projects.length} active projects on track` },
    { label: "Collections", score: collections, weight: 0.25, note: `${overdueInv} overdue of ${sentInv} recent invoices` },
    { label: "Profitability", score: profitability, weight: 0.25, note: `${margin}% margin over the last 30 days` },
    { label: "Capacity", score: capacity, weight: 0.15, note: `${overloaded} of ${people.length} people over capacity` },
  ];
  const score = Math.round(components.reduce((acc, c) => acc + c.score * c.weight, 0));
  const label: HealthScore["label"] = score >= 85 ? "Excellent" : score >= 70 ? "Healthy" : score >= 50 ? "Needs attention" : "At risk";
  return { score, label, components };
});
