import Link from "next/link";
import { Activity, AlertOctagon, AlertTriangle, Info, CalendarClock, Users, Gamepad2, Globe, Smartphone, Code2, PenTool, type LucideIcon } from "lucide-react";
import { GlassCard, CardHeader } from "@/components/ui/glass-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { formatMoney, formatDate, formatRelative, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type ProjectHealth, type ProjectCategory } from "@/generated/prisma/enums";
import type { RevenuePoint, ProjectHealthRow, WorkloadRow, ActivityRow, DeadlineRow, AlertRow } from "../queries/overview";

// ───────── Revenue ─────────

export function RevenueCard({ data }: { data: RevenuePoint[] }) {
  const points = data.map((d) => ({ month: d.month, revenue: Number(d.revenue), expenses: Number(d.expenses) }));
  const hasData = points.some((p) => p.revenue > 0 || p.expenses > 0);
  return (
    <GlassCard as="section" aria-labelledby="revenue-heading">
      <CardHeader
        title={<span id="revenue-heading">Revenue vs. expenses</span>}
        description="Paid invoices and recorded expenses, last 12 months"
        action={
          <div className="flex items-center gap-3 text-[11px] text-fg-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan" aria-hidden /> Revenue</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber" aria-hidden /> Expenses</span>
          </div>
        }
      />
      {hasData ? <RevenueChart data={points} /> : <EmptyState title="No financial records yet" description="Revenue and expenses will chart here once invoices are paid and expenses are recorded." />}
    </GlassCard>
  );
}

// ───────── Project health ─────────

const HEALTH_TONE: Record<ProjectHealth, BadgeTone> = { ON_TRACK: "emerald", AT_RISK: "amber", DELAYED: "rose" };
const CATEGORY_ICON: Record<ProjectCategory, LucideIcon> = {
  GAME_DEVELOPMENT: Gamepad2,
  WEB_DEVELOPMENT: Globe,
  MOBILE_APPLICATION: Smartphone,
  SOFTWARE_DEVELOPMENT: Code2,
  UI_UX_DESIGN: PenTool,
};

export function ProjectHealthCard({ rows }: { rows: ProjectHealthRow[] }) {
  return (
    <GlassCard as="section" padded={false} aria-labelledby="projects-heading" className="overflow-hidden">
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="projects-heading">Project health</span>} description="Active and planned work, highest risk first" />
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState title="No projects yet" description="Create your first project in the Projects module (Phase 2)." /></div>
      ) : (
        <div className="mt-4 overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-line text-left text-[11px] uppercase tracking-wider text-fg-subtle">
                <th scope="col" className="px-5 py-2.5 font-medium">Project</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Health</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Progress</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Budget used</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Deadline</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Open</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const Icon = CATEGORY_ICON[p.category as ProjectCategory] ?? Code2;
                const budgetNum = Number(p.budget);
                const usedPct = budgetNum > 0 ? Math.min(100, Math.round((Number(p.spent) / budgetNum) * 100)) : 0;
                const overdue = p.overdue;
                return (
                  <tr key={p.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-glass">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-line bg-glass text-fg-muted"><Icon className="h-4 w-4" aria-hidden /></span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{p.name}</p>
                          <p className="truncate text-xs text-fg-subtle">{humanize(p.category)}{p.manager ? ` · ${p.manager}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><Badge tone={HEALTH_TONE[p.health]} dot>{humanize(p.health)}</Badge></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} progress`}>
                          <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent-blue),var(--accent-violet))]" style={{ width: `${p.progress}%` }} />
                        </div>
                        <span className="text-xs tabular text-fg-muted">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("text-xs tabular", usedPct >= 100 ? "text-rose" : usedPct >= 80 ? "text-amber" : "text-fg-muted")}>{usedPct}% <span className="text-fg-subtle">of {formatMoney(p.budget, "USD", { compact: true })}</span></span>
                    </td>
                    <td className="px-3 py-3"><span className={cn("text-xs tabular", overdue ? "text-rose" : "text-fg-muted")}>{p.deadline ? formatDate(p.deadline) : "—"}</span></td>
                    <td className="px-5 py-3 text-right text-xs tabular text-fg-muted">{p.openTasks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}

// ───────── Workload ─────────

export function WorkloadCard({ rows }: { rows: WorkloadRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <GlassCard as="section" aria-labelledby="workload-heading">
      <CardHeader title={<span id="workload-heading">Team workload</span>} description="Open tasks per person" action={<Users className="h-4 w-4 text-fg-subtle" aria-hidden />} />
      {rows.length === 0 ? (
        <EmptyState title="No assigned work" description="Workload appears once tasks are assigned to team members." />
      ) : (
        <ul className="space-y-3.5">
          {rows.map((r) => {
            const heavy = r.total >= 8;
            return (
              <li key={r.userId} className="flex items-center gap-3">
                <Avatar name={r.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-fg">{r.name}</p>
                    <p className="shrink-0 text-xs tabular text-fg-muted">
                      {r.total} open{r.overdue > 0 && <span className="text-rose"> · {r.overdue} overdue</span>}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/8" aria-hidden>
                    <div className={cn("h-full rounded-full", heavy ? "bg-[linear-gradient(90deg,var(--accent-amber),var(--accent-rose))]" : "bg-[linear-gradient(90deg,var(--accent-blue),var(--accent-cyan))]")} style={{ width: `${Math.round((r.total / max) * 100)}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}

// ───────── Alerts ─────────

const SEVERITY: Record<AlertRow["severity"], { icon: LucideIcon; cls: string }> = {
  critical: { icon: AlertOctagon, cls: "text-rose border-rose/30 bg-rose/10" },
  warning: { icon: AlertTriangle, cls: "text-amber border-amber/30 bg-amber/10" },
  info: { icon: Info, cls: "text-blue border-blue/30 bg-blue/10" },
};

export function AlertsCard({ alerts }: { alerts: AlertRow[] }) {
  return (
    <GlassCard as="section" aria-labelledby="alerts-heading">
      <CardHeader title={<span id="alerts-heading">Needs your attention</span>} description="Rule-based signals from live records" />
      {alerts.length === 0 ? (
        <EmptyState title="All clear" description="No overdue invoices, slipping projects or budget breaches right now." />
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const { icon: Icon, cls } = SEVERITY[a.severity];
            return (
              <li key={a.id} className="flex items-start gap-3 rounded-md border border-line bg-glass px-3 py-2.5">
                <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border", cls)}><Icon className="h-3.5 w-3.5" aria-hidden /></span>
                <div className="min-w-0">
                  <p className="text-sm text-fg">{a.title}</p>
                  <p className="truncate text-xs text-fg-muted">{a.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}

// ───────── Deadlines ─────────

const PRIORITY_TONE: Record<string, BadgeTone> = { LOW: "neutral", MEDIUM: "blue", HIGH: "amber", CRITICAL: "rose" };

export function DeadlinesCard({ rows }: { rows: DeadlineRow[] }) {
  return (
    <GlassCard as="section" aria-labelledby="deadlines-heading">
      <CardHeader title={<span id="deadlines-heading">Upcoming deadlines</span>} description="Next 14 days, overdue first" action={<CalendarClock className="h-4 w-4 text-fg-subtle" aria-hidden />} />
      {rows.length === 0 ? (
        <EmptyState title="Nothing due soon" description="Tasks and project deliveries due in the next two weeks will show here." />
      ) : (
        <ul className="divide-y divide-line/60">
          {rows.map((d) => (
            <li key={`${d.kind}-${d.id}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className={cn("flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-sm border text-center leading-none", d.overdue ? "border-rose/30 bg-rose/10 text-rose" : "border-line bg-glass text-fg-muted")}>
                <span className="text-[10px] uppercase">{formatDate(d.dueDate, "short").split(" ")[0]}</span>
                <span className="text-sm font-semibold tabular">{d.dueDate.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-fg">{d.title}</p>
                <p className="truncate text-xs text-fg-subtle">{d.kind === "project" ? "Project delivery" : d.project}{d.assignee ? ` · ${d.assignee}` : ""}</p>
              </div>
              {d.priority && <Badge tone={PRIORITY_TONE[d.priority] ?? "neutral"}>{humanize(d.priority)}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

// ───────── Activity ─────────

export function ActivityCard({ rows }: { rows: ActivityRow[] }) {
  return (
    <GlassCard as="section" aria-labelledby="activity-heading">
      <CardHeader title={<span id="activity-heading">Recent activity</span>} description="Latest events across the company" action={<Activity className="h-4 w-4 text-fg-subtle" aria-hidden />} />
      {rows.length === 0 ? (
        <EmptyState title="No activity yet" description="Project, task and finance events will stream in here." />
      ) : (
        <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line">
          {rows.map((r) => (
            <li key={r.id} className="relative flex gap-3 pl-0">
              <Avatar name={r.actor} size="sm" className="relative z-10" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-fg">{r.message}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">{r.project ? `${r.project} · ` : ""}<time dateTime={r.createdAt.toISOString()}>{formatRelative(r.createdAt)}</time></p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  );
}

export function PhaseNotice() {
  return (
    <p className="text-center text-[11px] text-fg-subtle">
      Phase 1 shows live metrics from database records. Project, finance and team modules arrive in Phase 2; AI-generated insights in Phase 3.{" "}
      <Link href="/settings/security" className="text-fg-muted underline-offset-4 hover:underline">Secure your account</Link>.
    </p>
  );
}
