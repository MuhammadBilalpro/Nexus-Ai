import "server-only";
import { differenceInCalendarDays, endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { db } from "@/server/db";
import { env } from "@/lib/env";
import { Prisma } from "@/generated/prisma/client";
import { ActionStatus, ApprovalStatus, InvoiceStatus, MilestoneStatus, ProjectHealth, ProjectStatus, RunStatus, TaskStatus, type AgentKey } from "@/generated/prisma/enums";
import { money, subtract, sum, toFixed, percentChange, marginPercent, type Money } from "@/server/finance/money";
import { getCompanyHealth, getTodaysIntelligence } from "@/server/intelligence/digest";
import { formatMoney } from "@/lib/format";
import type { AnswerSeries, Fact, Intent, ProposedActionDraft, StructuredAnswer } from "@/features/assistant/types";
import { FINANCIAL_INTENTS, INTENT_AGENT, findProjectMention, routeIntent } from "./intents";

/**
 * NEXUS answer engine — deterministic, records-only.
 *
 * Every figure in an answer comes from a Prisma query over the same tables the
 * dashboard reads. There is no language model in this path yet (LLM narration
 * arrives in Phase 3); the "summary" strings are templated from the facts.
 * Nothing is invented: when a query returns nothing, the answer says so.
 */

const demoFilter = () => (env.DEMO_MODE ? {} : { isDemo: false });

export interface EngineInput {
  question: string;
  /** Explicit agent chosen by the user, or null for automatic routing. */
  agentKey: AgentKey | null;
  /** Whether the asking user may see money figures. */
  canViewFinancials: boolean;
}

/** Engine output before persistence: proposed actions are drafts without ids. */
export interface EngineResult {
  intent: Intent;
  agentKey: AgentKey;
  summary: string;
  facts: Fact[];
  series?: AnswerSeries;
  sources: string[];
  proposedActions: ProposedActionDraft[];
  followUps: string[];
  /** Short line stored on the AgentRun. */
  runSummary: string;
  runStatus: RunStatus;
}

export const SUGGESTED_FOLLOW_UPS = ["What is happening in my company today?", "Which projects are delayed?", "Which clients have pending payments?", "Which team members are overloaded?"];

export async function answerQuestion(input: EngineInput): Promise<EngineResult> {
  let intent = routeIntent(input.question);
  if (FINANCIAL_INTENTS.has(intent) && !input.canViewFinancials) intent = "forbidden";
  const agentKey = input.agentKey ?? INTENT_AGENT[intent];

  const result = await (async (): Promise<Omit<EngineResult, "agentKey" | "intent">> => {
    switch (intent) {
      case "status":
        return companyStatus();
      case "delayed":
        return delayedProjects(input.question);
      case "profit":
        return highestProfit();
      case "revenue":
        return revenueThisMonth();
      case "pending_payments":
        return pendingPayments();
      case "workload":
        return overloadedTeam();
      case "report":
        return performanceReport();
      case "forbidden":
        return forbidden();
      default:
        return fallback();
    }
  })();

  return { intent, agentKey, ...result };
}

// ───────── helpers ─────────

const ok = (runSummary: string, needsApproval = false): Pick<EngineResult, "runSummary" | "runStatus"> => ({ runSummary, runStatus: needsApproval ? RunStatus.AWAITING_APPROVAL : RunStatus.SUCCEEDED });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const fmt = (m: Money) => formatMoney(toFixed(m));
const clientLabel = (c: { company: string | null; name: string } | null | undefined) => c?.company ?? c?.name ?? "Unassigned client";

// ───────── intents ─────────

async function companyStatus() {
  const [insights, health] = await Promise.all([getTodaysIntelligence(), getCompanyHealth()]);
  const critical = insights.filter((i) => i.severity === "critical");
  const warnings = insights.filter((i) => i.severity === "warning");
  const summary =
    insights.length === 0
      ? `Company health is ${health.label.toLowerCase()} at ${health.score}/100 and nothing in the records needs your attention right now.`
      : `Company health is ${health.label.toLowerCase()} at ${health.score}/100. ${plural(insights.length, "development")} surfaced from today's records: ${critical.length} critical, ${warnings.length} to watch. ${critical[0] ? `Most urgent: ${critical[0].title}.` : warnings[0] ? `First to watch: ${warnings[0].title}.` : ""}`.trim();
  const facts: Fact[] = [
    { label: "Health score", value: `${health.score} / 100 · ${health.label}` },
    ...health.components.map((c) => ({ label: c.label, value: `${c.score} · ${c.note}` })),
    ...insights.slice(0, 5).map((i) => ({ label: i.severity === "critical" ? "Critical" : i.severity === "warning" ? "Watch" : i.severity === "positive" ? "Good" : "Note", value: i.title, href: i.href })),
  ];
  const followUps = insights.map((i) => i.followUp).filter((f): f is string => Boolean(f)).slice(0, 2);
  if (followUps.length < 2) followUps.push("Give me a complete company performance report");
  if (followUps.length < 3) followUps.push("Which project is generating the highest profit?");
  return {
    summary,
    facts,
    sources: ["Project", "Task", "Invoice", "Expense", "ClientApproval", "Milestone", "ProposedAction"],
    proposedActions: [],
    followUps,
    ...ok(`Company status compiled: ${plural(insights.length, "insight")}, health ${health.score}`),
  };
}

async function delayedProjects(question: string) {
  const demo = demoFilter();
  const now = new Date();
  const candidates = await db.project.findMany({ where: { ...demo, status: { in: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD, ProjectStatus.PLANNING] } }, select: { id: true, name: true, slug: true } });
  const focus = findProjectMention(question, candidates);

  if (focus) {
    const p = await db.project.findFirst({
      where: { ...demo, id: focus.id },
      select: {
        id: true, name: true, slug: true, health: true, status: true, deadline: true, progress: true,
        manager: { select: { name: true } },
        tasks: { where: { status: { not: TaskStatus.DONE } }, select: { id: true, title: true, dueDate: true, priority: true, assignee: { select: { name: true } } }, orderBy: { dueDate: "asc" } },
        milestones: { where: { status: { not: MilestoneStatus.COMPLETED } }, select: { title: true, dueDate: true, status: true }, orderBy: { dueDate: "asc" } },
        approvals: { where: { status: ApprovalStatus.PENDING }, select: { title: true, requestedAt: true, client: { select: { company: true, name: true } } } },
      },
    });
    if (!p) return fallback();
    const overdueTasks = p.tasks.filter((t) => t.dueDate && t.dueDate < now);
    const missed = p.milestones.filter((m) => m.status === MilestoneStatus.MISSED || m.dueDate < now);
    const daysLate = p.deadline ? differenceInCalendarDays(now, p.deadline) : null;
    const blockers: string[] = [];
    if (overdueTasks.length) blockers.push(plural(overdueTasks.length, "overdue task"));
    if (missed.length) blockers.push(plural(missed.length, "missed milestone"));
    if (p.approvals.length) blockers.push(plural(p.approvals.length, "client approval") + " pending");
    const summary = `${p.name} is ${p.health === ProjectHealth.DELAYED ? "flagged as delayed" : p.health === ProjectHealth.AT_RISK ? "at risk" : "on track"}${daysLate !== null && daysLate > 0 ? ` and ${daysLate} days past its deadline` : ""}, at ${p.progress}% progress with ${plural(p.tasks.length, "open task")}. ${blockers.length ? `What is blocking it: ${blockers.join(", ")}.` : "No overdue tasks, missed milestones or pending approvals are recorded against it."}`;
    const facts: Fact[] = [
      { label: "Health", value: p.health.replace("_", " ").toLowerCase(), href: `/projects/${p.slug}` },
      { label: "Deadline", value: p.deadline ? `${format(p.deadline, "MMM d, yyyy")}${daysLate && daysLate > 0 ? ` · ${daysLate}d late` : ""}` : "Not set" },
      { label: "Progress", value: `${p.progress}%` },
      { label: "Manager", value: p.manager?.name ?? "Unassigned" },
      ...overdueTasks.slice(0, 4).map((t) => ({ label: "Overdue task", value: `${t.title}${t.assignee?.name ? ` · ${t.assignee.name}` : ""} · due ${format(t.dueDate as Date, "MMM d")}`, href: `/projects/${p.slug}` })),
      ...missed.slice(0, 3).map((m) => ({ label: "Milestone", value: `${m.title} · ${m.status === MilestoneStatus.MISSED ? "missed" : "overdue"} ${format(m.dueDate, "MMM d")}`, href: `/projects/${p.slug}` })),
      ...p.approvals.slice(0, 3).map((a) => ({ label: "Awaiting approval", value: `${a.title} · ${clientLabel(a.client)} · ${differenceInCalendarDays(now, a.requestedAt)}d`, href: `/projects/${p.slug}` })),
    ];
    return {
      summary,
      facts,
      sources: ["Project", "Task", "Milestone", "ClientApproval"],
      proposedActions: [],
      followUps: ["Which team members are overloaded?", "Which clients have pending payments?", "What is happening in my company today?"],
      ...ok(`Answered: what is blocking ${p.name} → ${blockers.join(", ") || "no recorded blockers"}`),
    };
  }

  const delayed = await db.project.findMany({
    where: { ...demo, status: { in: [ProjectStatus.ACTIVE, ProjectStatus.ON_HOLD] }, OR: [{ health: ProjectHealth.DELAYED }, { deadline: { lt: now } }] },
    select: { id: true, name: true, slug: true, health: true, deadline: true, progress: true, manager: { select: { name: true } }, _count: { select: { tasks: { where: { status: { not: TaskStatus.DONE } } } } } },
    orderBy: { deadline: "asc" },
  });
  const atRisk = await db.project.findMany({ where: { ...demo, status: ProjectStatus.ACTIVE, health: ProjectHealth.AT_RISK, deadline: { gte: now } }, select: { name: true, slug: true, progress: true }, take: 3 });
  const summary =
    delayed.length === 0
      ? `No active project is delayed or past its deadline.${atRisk.length ? ` ${plural(atRisk.length, "project is", "projects are")} flagged at risk: ${atRisk.map((p) => p.name).join(", ")}.` : ""}`
      : `${plural(delayed.length, "project is", "projects are")} delayed: ${delayed.map((p) => `${p.name} (${p.progress}%${p.deadline && p.deadline < now ? `, ${differenceInCalendarDays(now, p.deadline)}d past deadline` : ""})`).join("; ")}.${atRisk.length ? ` A further ${plural(atRisk.length, "project is", "projects are")} at risk.` : ""}`;
  const facts: Fact[] = [
    ...delayed.map((p) => ({ label: p.name, value: `${p.progress}% · ${plural(p._count.tasks, "open task")}${p.deadline ? ` · due ${format(p.deadline, "MMM d")}` : ""}${p.manager?.name ? ` · ${p.manager.name}` : ""}`, href: `/projects/${p.slug}` })),
    ...atRisk.map((p) => ({ label: `${p.name} (at risk)`, value: `${p.progress}%`, href: `/projects/${p.slug}` })),
  ];
  return {
    summary,
    facts,
    sources: ["Project", "Task"],
    proposedActions: [],
    followUps: [...delayed.slice(0, 2).map((p) => `What is blocking ${p.name}?`), "Which team members are overloaded?"].slice(0, 3),
    ...ok(`Answered: which projects are delayed → ${delayed.map((p) => p.name).join(", ") || "none"}`),
  };
}

async function highestProfit() {
  const demo = demoFilter();
  const projects = await db.project.findMany({
    where: demo,
    select: { id: true, name: true, slug: true, status: true, invoices: { where: { status: InvoiceStatus.PAID }, select: { amount: true } }, expenses: { select: { amount: true } } },
  });
  const rows = projects
    .map((p) => {
      const revenue = sum(p.invoices.map((i) => i.amount));
      const expenses = sum(p.expenses.map((e) => e.amount));
      const profit = subtract(revenue, expenses);
      return { ...p, revenue, expenses, profit, margin: marginPercent(profit, revenue) };
    })
    .filter((r) => !r.revenue.isZero() || !r.expenses.isZero())
    .sort((a, b) => b.profit.comparedTo(a.profit));
  if (rows.length === 0) {
    return { summary: "No paid invoices or expenses are recorded against any project yet, so profit per project cannot be computed.", facts: [], sources: ["Project", "Invoice", "Expense"], proposedActions: [], followUps: SUGGESTED_FOLLOW_UPS.slice(0, 3), ...ok("Profit by project: no financial records") };
  }
  const top = rows[0]!;
  const losing = rows.filter((r) => r.profit.isNegative());
  const summary = `${top.name} is generating the highest profit at ${fmt(top.profit)} (${fmt(top.revenue)} collected against ${fmt(top.expenses)} in expenses${top.margin !== null ? `, ${top.margin}% margin` : ""}).${rows[1] ? ` Next is ${rows[1].name} at ${fmt(rows[1].profit)}.` : ""}${losing.length ? ` ${plural(losing.length, "project is", "projects are")} currently loss-making: ${losing.map((r) => r.name).join(", ")}.` : ""}`;
  return {
    summary,
    facts: rows.slice(0, 6).map((r) => ({ label: r.name, value: `${fmt(r.profit)} profit · ${r.margin === null ? "no revenue" : `${r.margin}% margin`} · ${r.status.toLowerCase().replace("_", " ")}`, href: `/projects/${r.slug}` })),
    series: { type: "bars" as const, data: rows.slice(0, 8).map((r) => ({ label: shorten(r.name), value: Number(toFixed(r.profit)) })), dataKey: "value" as const, name: "Profit", money: true },
    sources: ["Project", "Invoice (PAID)", "Expense"],
    proposedActions: [],
    followUps: ["What is our total revenue this month?", "Which clients have pending payments?", `What is blocking ${rows[rows.length - 1]!.name}?`],
    ...ok(`Answered: highest-profit project → ${top.name} (${fmt(top.profit)})`),
  };
}

async function revenueThisMonth() {
  const demo = demoFilter();
  const now = new Date();
  const start = startOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));
  const from = startOfMonth(subMonths(now, 5));
  const demoSql = env.DEMO_MODE ? Prisma.empty : Prisma.sql`AND "isDemo" = false`;
  const [cur, prev, pendingAgg, months, count] = await Promise.all([
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: InvoiceStatus.PAID, paidAt: { gte: start } } }),
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: InvoiceStatus.PAID, paidAt: { gte: prevStart, lte: prevEnd } } }),
    db.invoice.aggregate({ _sum: { amount: true }, where: { ...demo, status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] } } }),
    db.$queryRaw<{ month: Date; total: Prisma.Decimal }[]>`
      SELECT date_trunc('month', "paidAt") AS month, SUM("amount") AS total
      FROM "Invoice" WHERE "status" = 'PAID' AND "paidAt" >= ${from} ${demoSql}
      GROUP BY 1 ORDER BY 1`,
    db.invoice.count({ where: { ...demo, status: InvoiceStatus.PAID, paidAt: { gte: start } } }),
  ]);
  const current = money(cur._sum.amount);
  const previous = money(prev._sum.amount);
  const delta = percentChange(current, previous);
  const map = new Map(months.map((m) => [format(m.month, "yyyy-MM"), money(m.total)]));
  const series = Array.from({ length: 6 }, (_, i) => {
    const d = startOfMonth(subMonths(now, 5 - i));
    return { label: format(d, "MMM"), value: Number(toFixed(map.get(format(d, "yyyy-MM")) ?? money(0))) };
  });
  const summary = `Revenue this month (${format(now, "MMMM")}) is ${fmt(current)} from ${plural(count, "paid invoice")}, ${delta === null ? "with no paid invoices last month to compare against" : delta === 0 ? "level with last month" : `${delta > 0 ? "up" : "down"} ${Math.abs(delta)}% on ${fmt(previous)} in ${format(prevStart, "MMMM")}`}. A further ${fmt(money(pendingAgg._sum.amount))} has been invoiced and is not yet paid.`;
  return {
    summary,
    facts: [
      { label: `Paid · ${format(now, "MMMM")}`, value: fmt(current), href: "/insights?view=revenue" },
      { label: `Paid · ${format(prevStart, "MMMM")}`, value: fmt(previous) },
      { label: "Change", value: delta === null ? "no baseline" : `${delta > 0 ? "+" : ""}${delta}%` },
      { label: "Invoiced, unpaid", value: fmt(money(pendingAgg._sum.amount)), href: "/insights?view=revenue" },
    ],
    series: { type: "area" as const, data: series, dataKey: "value" as const, name: "Revenue", money: true },
    sources: ["Invoice (PAID, paidAt)", "Invoice (SENT, OVERDUE)"],
    proposedActions: [],
    followUps: ["Which project is generating the highest profit?", "Which clients have pending payments?", "Give me a complete company performance report"],
    ...ok(`Answered: revenue this month → ${fmt(current)}`),
  };
}

async function pendingPayments() {
  const demo = demoFilter();
  const now = new Date();
  const invoices = await db.invoice.findMany({
    where: { ...demo, status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE] } },
    select: { id: true, number: true, amount: true, dueAt: true, status: true, client: { select: { id: true, company: true, name: true } }, project: { select: { name: true, slug: true } } },
    orderBy: { dueAt: "asc" },
  });
  if (invoices.length === 0) {
    return { summary: "Every issued invoice has been paid. No client currently owes anything.", facts: [], sources: ["Invoice", "Client"], proposedActions: [], followUps: ["What is our total revenue this month?", "Which project is generating the highest profit?", "What is happening in my company today?"], ...ok("Pending payments: none") };
  }
  const byClient = new Map<string, { label: string; total: Money; overdue: number; count: number }>();
  for (const inv of invoices) {
    const key = inv.client?.id ?? "none";
    const entry = byClient.get(key) ?? { label: clientLabel(inv.client), total: money(0), overdue: 0, count: 0 };
    entry.total = entry.total.plus(money(inv.amount));
    entry.count += 1;
    if (inv.dueAt < now) entry.overdue += 1;
    byClient.set(key, entry);
  }
  const clients = [...byClient.values()].sort((a, b) => b.total.comparedTo(a.total));
  const overdue = invoices.filter((i) => i.dueAt < now);
  const total = sum(invoices.map((i) => i.amount));
  const overdueTotal = sum(overdue.map((i) => i.amount));
  const summary = `${plural(clients.length, "client")} owe ${fmt(total)} across ${plural(invoices.length, "open invoice")}. ${overdue.length ? `${fmt(overdueTotal)} of that is overdue (${plural(overdue.length, "invoice")}), the oldest being ${overdue[0]!.number} for ${clientLabel(overdue[0]!.client)}, ${differenceInCalendarDays(now, overdue[0]!.dueAt)} days late.` : "Nothing is past due yet."} ${clients[0] ? `Largest balance: ${clients[0].label} at ${fmt(clients[0].total)}.` : ""}`.trim();
  const proposedActions: ProposedActionDraft[] = overdue.slice(0, 4).map((inv) => ({
    kind: "send_invoice_followup",
    title: `Send payment reminder for ${inv.number} (${clientLabel(inv.client)}, ${fmt(money(inv.amount))})`,
    rationale: `${inv.number} was due ${format(inv.dueAt, "MMM d")} and is ${differenceInCalendarDays(now, inv.dueAt)} days late. A courteous reminder is the standard first step before escalation.`,
    risk: "low",
    payload: { invoiceId: inv.id, invoice: inv.number, client: clientLabel(inv.client), amount: toFixed(money(inv.amount)), template: "friendly_reminder" },
  }));
  return {
    summary,
    facts: [
      ...clients.slice(0, 5).map((c) => ({ label: c.label, value: `${fmt(c.total)} · ${plural(c.count, "invoice")}${c.overdue ? ` · ${c.overdue} overdue` : ""}`, href: "/insights?view=revenue" })),
      ...overdue.slice(0, 4).map((i) => ({ label: i.number, value: `${fmt(money(i.amount))} · ${differenceInCalendarDays(now, i.dueAt)}d late${i.project ? ` · ${i.project.name}` : ""}`, href: i.project ? `/projects/${i.project.slug}` : "/insights?view=revenue" })),
    ],
    series: { type: "bars" as const, data: clients.slice(0, 8).map((c) => ({ label: shorten(c.label), value: Number(toFixed(c.total)) })), dataKey: "value" as const, name: "Outstanding", money: true },
    sources: ["Invoice (SENT, OVERDUE)", "Client", "Project"],
    proposedActions,
    followUps: ["What is our total revenue this month?", "Which project is generating the highest profit?", "What is happening in my company today?"],
    ...ok(`Pending payments: ${fmt(total)} across ${plural(invoices.length, "invoice")}; ${plural(proposedActions.length, "reminder")} proposed`, proposedActions.length > 0),
  };
}

async function overloadedTeam() {
  const demo = demoFilter();
  const now = new Date();
  const users = await db.user.findMany({
    where: { ...demo, isActive: true, tasks: { some: { status: { not: TaskStatus.DONE } } } },
    select: { id: true, name: true, title: true, tasks: { where: { status: { not: TaskStatus.DONE } }, select: { id: true, dueDate: true, project: { select: { name: true } } } } },
  });
  const rows = users
    .map((u) => ({ id: u.id, name: u.name ?? "Unnamed", title: u.title, open: u.tasks.length, overdue: u.tasks.filter((t) => t.dueDate && t.dueDate < now).length, projects: [...new Set(u.tasks.map((t) => t.project.name))] }))
    .sort((a, b) => b.open - a.open);
  const heavy = rows.filter((r) => r.open >= 8);
  const light = rows.filter((r) => r.open < 8).sort((a, b) => a.open - b.open);
  const summary =
    heavy.length === 0
      ? `Nobody is above the 8-open-task threshold. ${rows[0] ? `${rows[0].name} carries the most with ${plural(rows[0].open, "open task")}.` : "No open tasks are assigned."}`
      : `${heavy.map((r) => `${r.name} (${r.open} open${r.overdue ? `, ${r.overdue} overdue` : ""})`).join(" and ")} ${heavy.length === 1 ? "is" : "are"} above the 8-task threshold.${light[0] ? ` ${light[0].name} has the most capacity at ${plural(light[0].open, "open task")}.` : ""}`;
  const proposedActions: ProposedActionDraft[] = heavy
    .filter((r) => r.open >= 10 && light[0])
    .slice(0, 2)
    .map((r) => ({
      kind: "reassign_tasks",
      title: `Rebalance ${r.open - 8} tasks from ${r.name} to ${light[0]!.name}`,
      rationale: `${r.name} has ${r.open} open tasks (${r.overdue} overdue) across ${r.projects.slice(0, 2).join(" and ")}; ${light[0]!.name} has ${light[0]!.open}. Moving the lowest-priority tasks brings both under the threshold.`,
      risk: "medium",
      payload: { fromUserId: r.id, from: r.name, toUserId: light[0]!.id, to: light[0]!.name, count: r.open - 8 },
    }));
  return {
    summary,
    facts: rows.slice(0, 6).map((r) => ({ label: r.name, value: `${plural(r.open, "open task")} · ${r.overdue} overdue${r.title ? ` · ${r.title}` : ""}`, href: "/insights?view=workload" })),
    series: { type: "bars" as const, data: rows.slice(0, 8).map((r) => ({ label: r.name.split(" ")[0] ?? r.name, value: r.open })), dataKey: "value" as const, name: "Open tasks", money: false },
    sources: ["User", "Task (not DONE)"],
    proposedActions,
    followUps: ["Which projects are delayed?", "What is happening in my company today?", "Give me a complete company performance report"],
    ...ok(`Workload check: ${heavy.length ? heavy.map((h) => `${h.name} at ${h.open}`).join(", ") : "nobody over threshold"}${proposedActions.length ? "; reassignment proposed" : ""}`, proposedActions.length > 0),
  };
}

async function performanceReport() {
  const [status, delayed, profit, revenue, payments, team] = await Promise.all([companyStatus(), delayedProjects(""), highestProfit(), revenueThisMonth(), pendingPayments(), overloadedTeam()]);
  const summary = [status.summary, revenue.summary.split(". ")[0] + ".", profit.summary.split(". ")[0] + ".", delayed.summary.split(". ")[0] + ".", payments.summary.split(". ")[0] + ".", team.summary.split(". ")[0] + "."].join(" ");
  const take = (facts: Fact[], n: number, prefix: string) => facts.slice(0, n).map((f) => ({ ...f, label: `${prefix} · ${f.label}` }));
  return {
    summary,
    facts: [...take(status.facts, 1, "Health"), ...take(revenue.facts, 2, "Revenue"), ...take(profit.facts, 2, "Profit"), ...take(delayed.facts, 2, "Delivery"), ...take(payments.facts, 2, "Receivables"), ...take(team.facts, 2, "Team")],
    series: revenue.series,
    sources: [...new Set([...status.sources, ...revenue.sources, ...profit.sources, ...payments.sources, ...team.sources])],
    proposedActions: [],
    followUps: ["Which projects are delayed?", "Which clients have pending payments?", "Which team members are overloaded?"],
    ...ok("Generated company performance report"),
  };
}

function forbidden() {
  return {
    summary: "That question needs financial figures, which your role is not permitted to view. Ask about projects, deadlines, team workload or client approvals instead, or request the finance permission from an administrator.",
    facts: [],
    sources: [],
    proposedActions: [],
    followUps: ["Which projects are delayed?", "Which team members are overloaded?", "What is happening in my company today?"],
    ...ok("Declined: financial question without dashboard:view_financials"),
  };
}

function fallback() {
  return {
    summary: "I can answer questions about projects, finance, team and clients from company records: delivery status and blockers, revenue and profit by project, outstanding payments and team workload. I will not guess at anything the records do not contain. Try one of the questions below.",
    facts: [],
    sources: [],
    proposedActions: [],
    followUps: ["What is happening in my company today?", "Which projects are delayed?", "Which clients have pending payments?"],
    ...ok("No matching intent; suggested questions returned"),
  };
}

function shorten(name: string, max = 18): string {
  const clean = name.split(" — ")[0] ?? name;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Explicitly re-exported so the actions layer can persist actions as PENDING without importing enums twice. */
export { ActionStatus };
export type { StructuredAnswer };
