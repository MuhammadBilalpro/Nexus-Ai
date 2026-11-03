import Link from "next/link";
import { Flag, Users, Activity as ActivityIcon, ListTodo } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { TaskStatus, MilestoneStatus, ProjectStatus } from "@/generated/prisma/enums";
import { formatDate, formatMoney, formatRelative, humanize, categoryLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectDetail, UserOption } from "../queries";
import { TaskStatusSelect, AddMemberForm, CompleteMilestoneButton } from "./controls";
import { AddTaskForm } from "./add-task-form";
import { HEALTH_TONE, STATUS_TONE, PRIORITY_TONE, TASK_STATUS_TONE, MILESTONE_TONE, PROGRESS_TONE, daysLabel } from "./shared";

// ───────── Header ─────────

export function ProjectHeader({ p }: { p: ProjectDetail }) {
  const completed = p.status === ProjectStatus.COMPLETED;
  const late = p.daysLeft !== null && p.daysLeft < 0 && !completed;
  return (
    <header className="mb-6">
      <Link href="/projects" className="text-[13px] text-fg-subtle hover:text-fg">Projects</Link>
      <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-fg sm:text-2xl">{p.name}</h1>
            <Badge tone={STATUS_TONE[p.status]}>{humanize(p.status)}</Badge>
            <Badge tone={HEALTH_TONE[p.health]} dot>{humanize(p.health)}</Badge>
          </div>
          <p className="mt-1 text-[14px] text-fg-muted">
            {categoryLabel(p.category)}
            {p.client ? ` · ${p.client}` : ""}
            {p.manager?.name ? ` · managed by ${p.manager.name}` : " · no manager"}
          </p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="surface p-4">
          <dt className="text-[12px] text-fg-muted">Progress</dt>
          <dd className="mt-1.5 text-[22px] font-semibold leading-none tabular tracking-tight">{p.progress}%</dd>
          <Progress className="mt-3" value={p.progress} tone={PROGRESS_TONE[p.health]} label={`Progress ${p.progress}%`} />
        </div>
        <div className="surface p-4">
          <dt className="text-[12px] text-fg-muted">Budget vs spent</dt>
          <dd className="mt-1.5 text-[22px] font-semibold leading-none tabular tracking-tight">{formatMoney(p.spent)}<span className="text-[13px] font-normal text-fg-subtle"> / {formatMoney(p.budget)}</span></dd>
          <Progress className="mt-3" value={p.spendPercent} tone={p.spendPercent >= 100 ? "danger" : p.spendPercent >= 80 ? "warning" : "default"} label={`Spent ${p.spendPercent}% of budget`} />
        </div>
        <div className="surface p-4">
          <dt className="text-[12px] text-fg-muted">Deadline</dt>
          <dd className="mt-1.5 text-[22px] font-semibold leading-none tabular tracking-tight">{p.deadline ? formatDate(p.deadline, "short") : "—"}</dd>
          <p className={cn("mt-2.5 text-xs", late ? "text-danger" : "text-fg-subtle")}>{p.deadline ? daysLabel(p.daysLeft, completed) : "No deadline set"}{p.deadline ? ` · ${formatDate(p.deadline).split(", ")[1] ?? ""}` : ""}</p>
        </div>
        <div className="surface p-4">
          <dt className="text-[12px] text-fg-muted">Manager</dt>
          <dd className="mt-2 flex items-center gap-2">
            <Avatar name={p.manager?.name} size="md" />
            <span className="truncate text-[14px] font-medium text-fg">{p.manager?.name ?? "Unassigned"}</span>
          </dd>
          <p className="mt-2.5 text-xs text-fg-subtle">{p.members.length} team {p.members.length === 1 ? "member" : "members"}</p>
        </div>
      </dl>
    </header>
  );
}

// ───────── Overview ─────────

function healthNote(p: ProjectDetail): string {
  const open = p.tasks.filter((t) => t.status !== TaskStatus.DONE);
  const overdue = open.filter((t) => t.overdue).length;
  const missed = p.milestones.filter((m) => m.status === MilestoneStatus.MISSED).length;
  if (p.status === ProjectStatus.COMPLETED) return `Delivered${p.completedAt ? ` on ${formatDate(p.completedAt)}` : ""}.`;
  if (p.health === "DELAYED") {
    const reasons = [p.daysLeft !== null && p.daysLeft < 0 ? `the deadline passed ${Math.abs(p.daysLeft)} days ago` : null, missed ? `${missed} milestone${missed === 1 ? "" : "s"} missed` : null].filter(Boolean);
    return `Delayed: ${reasons.join(" and ") || "flagged by the team"}. ${open.length} tasks remain open.`;
  }
  if (p.health === "AT_RISK") return `At risk: ${overdue} of ${open.length} open tasks are past their due date (over a quarter).`;
  return `On track: ${open.length} open tasks, ${overdue} overdue, no missed milestones.`;
}

export function OverviewTab({ p, canUpdate }: { p: ProjectDetail; canUpdate: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card as="section" aria-labelledby="desc-heading">
          <CardHeader title={<span id="desc-heading">About</span>} />
          {p.description ? <p className="whitespace-pre-line text-[14px] leading-relaxed text-fg">{p.description}</p> : <p className="text-[13px] text-fg-subtle">No description yet.</p>}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-[13px] sm:grid-cols-4">
            <div><dt className="text-fg-subtle">Start</dt><dd className="mt-0.5 text-fg">{p.startDate ? formatDate(p.startDate) : "—"}</dd></div>
            <div><dt className="text-fg-subtle">Deadline</dt><dd className="mt-0.5 text-fg">{p.deadline ? formatDate(p.deadline) : "—"}</dd></div>
            <div><dt className="text-fg-subtle">Tasks</dt><dd className="mt-0.5 text-fg tabular">{p.tasks.filter((t) => t.status === TaskStatus.DONE).length} / {p.tasks.length} done</dd></div>
            <div><dt className="text-fg-subtle">Milestones</dt><dd className="mt-0.5 text-fg tabular">{p.milestones.filter((m) => m.status === MilestoneStatus.COMPLETED).length} / {p.milestones.length} complete</dd></div>
          </dl>
        </Card>
        <MilestonesCard p={p} canUpdate={canUpdate} />
      </div>
      <Card as="section" aria-labelledby="hn-heading" className="self-start">
        <CardHeader title={<span id="hn-heading">Health</span>} action={<Badge tone={HEALTH_TONE[p.health]} dot>{humanize(p.health)}</Badge>} />
        <p className="text-[13px] leading-relaxed text-fg-muted">{healthNote(p)}</p>
        <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-fg-subtle">Health is recomputed from tasks and milestones after every change: delayed when the deadline has passed or a milestone is missed, at risk when more than a quarter of open tasks are overdue.</p>
      </Card>
    </div>
  );
}

function MilestonesCard({ p, canUpdate }: { p: ProjectDetail; canUpdate: boolean }) {
  return (
    <Card as="section" aria-labelledby="ms-heading" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="ms-heading">Milestones</span>} description={`${p.milestones.filter((m) => m.status === MilestoneStatus.COMPLETED).length} of ${p.milestones.length} complete`} />
      {p.milestones.length === 0 ? (
        <div className="p-5"><EmptyState compact icon={Flag} title="No milestones" /></div>
      ) : (
        <ol className="mt-3 divide-y divide-line">
          {p.milestones.map((m) => {
            const done = m.status === MilestoneStatus.COMPLETED;
            return (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <span className={cn("h-2.5 w-2.5 shrink-0 rotate-45 rounded-[2px] border", done ? "border-success bg-success" : m.status === MilestoneStatus.MISSED ? "border-danger bg-danger" : "border-fg-muted bg-surface")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-[14px]", done ? "text-fg-muted line-through decoration-line-strong" : "text-fg")}>{m.title}</p>
                  <p className="truncate text-xs text-fg-subtle">{done && m.completedAt ? `Completed ${formatDate(m.completedAt)}` : `Due ${formatDate(m.dueDate)}`}{m.description ? ` · ${m.description}` : ""}</p>
                </div>
                <Badge tone={MILESTONE_TONE[m.status]}>{humanize(m.status)}</Badge>
                {canUpdate && !done && <CompleteMilestoneButton milestoneId={m.id} title={m.title} />}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

// ───────── Tasks ─────────

const TASK_GROUPS: TaskStatus[] = [TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.TODO, TaskStatus.DONE];

export function TasksTab({ p, users, canUpdate, canCreate }: { p: ProjectDetail; users: UserOption[]; canUpdate: boolean; canCreate: boolean }) {
  return (
    <div className="space-y-4">
      {canCreate && <AddTaskForm projectId={p.id} assignees={users} />}
      {p.tasks.length === 0 ? (
        <Card><EmptyState icon={ListTodo} title="No tasks yet" description={canCreate ? "Add the first task to start tracking progress." : "Tasks will appear here once the team adds them."} /></Card>
      ) : (
        TASK_GROUPS.map((status) => {
          const tasks = p.tasks.filter((t) => t.status === status);
          if (tasks.length === 0) return null;
          return (
            <Card key={status} as="section" aria-labelledby={`tg-${status}`} padded={false}>
              <div className="flex items-center gap-2 px-5 pt-4 pb-1">
                <h2 id={`tg-${status}`} className="text-[14px] font-semibold text-fg">{humanize(status)}</h2>
                <span className="text-xs tabular text-fg-subtle">{tasks.length}</span>
              </div>
              <Table aria-label={`${humanize(status)} tasks`}>
                <THead className="sr-only">
                  <tr><TH>Task</TH><TH>Priority</TH><TH>Assignee</TH><TH>Due</TH><TH>Status</TH></tr>
                </THead>
                <TBody>
                  {tasks.map((t) => (
                    <TR key={t.id} interactive>
                      <TD className="w-full"><span className={cn("text-[14px]", status === TaskStatus.DONE ? "text-fg-muted" : "text-fg")}>{t.title}</span></TD>
                      <TD><Badge tone={PRIORITY_TONE[t.priority]}>{humanize(t.priority)}</Badge></TD>
                      <TD>
                        <span className="flex items-center gap-2 whitespace-nowrap text-[13px] text-fg-muted">
                          <Avatar name={t.assignee?.name} size="xs" />
                          {t.assignee?.name ?? "Unassigned"}
                        </span>
                      </TD>
                      <TD className={cn("whitespace-nowrap text-[13px] tabular", t.overdue ? "font-medium text-danger" : "text-fg-muted")}>{t.dueDate ? formatDate(t.dueDate, "short") : "—"}</TD>
                      <TD>{canUpdate ? <TaskStatusSelect taskId={t.id} status={t.status} title={t.title} /> : <Badge tone={TASK_STATUS_TONE[t.status]}>{humanize(t.status)}</Badge>}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ───────── Team ─────────

export function TeamTab({ p, users, canAssign }: { p: ProjectDetail; users: UserOption[]; canAssign: boolean }) {
  const memberIds = new Set(p.members.map((m) => m.userId));
  const candidates = users.filter((u) => !memberIds.has(u.id));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Card as="section" aria-labelledby="team-heading" padded={false} className="xl:col-span-2">
        <CardHeader className="mb-0 px-5 pt-5" title={<span id="team-heading">Team</span>} description={`${p.members.length} ${p.members.length === 1 ? "member" : "members"}`} />
        {p.members.length === 0 ? (
          <div className="p-5"><EmptyState compact icon={Users} title="No team members yet" /></div>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {p.members.map((m) => (
              <li key={m.userId} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={m.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-fg">{m.name}{p.manager?.id === m.userId && <span className="ml-2 text-xs font-normal text-fg-subtle">Manager</span>}</p>
                  <p className="truncate text-xs text-fg-subtle">{m.title ?? "—"}</p>
                </div>
                <Badge tone="neutral">{m.role}</Badge>
                <span className="hidden text-xs text-fg-subtle sm:block">joined {formatDate(m.joinedAt, "short")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canAssign && (
        <Card as="section" aria-labelledby="add-heading" className="self-start">
          <CardHeader title={<span id="add-heading">Add to the team</span>} description="Their job title becomes the project role." />
          <AddMemberForm projectId={p.id} candidates={candidates} />
        </Card>
      )}
    </div>
  );
}

// ───────── Activity ─────────

export function ActivityTab({ p }: { p: ProjectDetail }) {
  return (
    <Card as="section" aria-labelledby="act-heading" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="act-heading">Activity</span>} description="Most recent first" />
      {p.activities.length === 0 ? (
        <div className="p-5"><EmptyState compact icon={ActivityIcon} title="No activity recorded" /></div>
      ) : (
        <ol className="mt-3 divide-y divide-line">
          {p.activities.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3">
              <Avatar name={a.actor} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-fg">{a.message}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  <span className="font-mono text-[11px]">{a.type}</span> · <time dateTime={a.createdAt.toISOString()} title={formatDate(a.createdAt)}>{formatRelative(a.createdAt)}</time>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
