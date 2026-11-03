import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Progress } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { AreaTrend } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import { formatDate, humanize, categoryLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectHealthRow, DeadlineRow, RevenuePoint, WorkloadRow } from "@/features/dashboard/queries/overview";
import type { ProjectHealth } from "@/generated/prisma/enums";

const HEALTH_TONE: Record<ProjectHealth, BadgeTone> = { ON_TRACK: "success", AT_RISK: "warning", DELAYED: "danger" };

export function RevenueGlance({ data }: { data: RevenuePoint[] }) {
  const points = data.map((d) => ({ label: d.month, revenue: Number(d.revenue), expenses: Number(d.expenses) }));
  const hasData = points.some((p) => p.revenue > 0 || p.expenses > 0);
  return (
    <Card as="section" aria-labelledby="rev-heading">
      <CardHeader
        title={<span id="rev-heading">Revenue and expenses</span>}
        description="Paid invoices against recorded expenses, last 12 months"
        action={
          <Link href="/insights?view=revenue">
            <Button variant="ghost" size="sm">Open insights</Button>
          </Link>
        }
      />
      {hasData ? (
        <AreaTrend ariaLabel="Monthly revenue and expenses" data={points} series={[{ key: "revenue", name: "Revenue" }, { key: "expenses", name: "Expenses", muted: true }]} />
      ) : (
        <EmptyState compact title="No financial records yet" description="Revenue and expenses chart here once invoices are paid and expenses recorded." />
      )}
    </Card>
  );
}

export function ProjectsGlance({ rows }: { rows: ProjectHealthRow[] }) {
  return (
    <Card as="section" aria-labelledby="proj-heading" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="proj-heading">Active projects</span>} description="Highest risk first" action={<Link href="/projects"><Button variant="ghost" size="sm">All projects</Button></Link>} />
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No active projects" description="Create a project to start tracking delivery." /></div>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.slice(0, 5).map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.slug}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface-2/60">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-medium text-fg">{p.name}</p>
                    <Badge tone={HEALTH_TONE[p.health]} dot>{humanize(p.health)}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-fg-subtle">{categoryLabel(p.category)}{p.manager ? ` · ${p.manager}` : ""}{p.deadline ? ` · due ${formatDate(p.deadline)}` : ""}</p>
                </div>
                <div className="hidden w-28 sm:block">
                  <Progress value={p.progress} tone={p.health === "DELAYED" ? "danger" : p.health === "AT_RISK" ? "warning" : "default"} label={`${p.name} progress`} />
                </div>
                <span className="w-10 text-right text-xs tabular text-fg-muted">{p.progress}%</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function DeadlinesGlance({ rows }: { rows: DeadlineRow[] }) {
  return (
    <Card as="section" aria-labelledby="dl-heading" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="dl-heading">Important deadlines</span>} description="Next 14 days" />
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState compact title="Nothing due soon" /></div>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {rows.slice(0, 6).map((d) => (
            <li key={`${d.kind}-${d.id}`} className="flex items-center gap-3 px-5 py-2.5">
              <div className={cn("flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-sm border text-center leading-none", d.overdue ? "border-danger/30 bg-danger-soft text-danger" : "border-line bg-surface-2 text-fg-muted")}>
                <span className="text-[9px] uppercase">{formatDate(d.dueDate, "short").split(" ")[0]}</span>
                <span className="mt-0.5 text-[13px] font-semibold tabular">{d.dueDate.getDate()}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-fg">{d.title}</p>
                <p className="truncate text-xs text-fg-subtle">{d.kind === "project" ? "Project delivery" : d.project}{d.assignee ? ` · ${d.assignee}` : ""}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CapacityGlance({ rows }: { rows: WorkloadRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <Card as="section" aria-labelledby="cap-heading">
      <CardHeader title={<span id="cap-heading">Team capacity</span>} description="Open tasks per person" action={<Link href="/insights?view=workload"><Button variant="ghost" size="sm">Details</Button></Link>} />
      {rows.length === 0 ? (
        <EmptyState compact title="No assigned work" />
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, 5).map((r) => (
            <li key={r.userId} className="flex items-center gap-3">
              <Avatar name={r.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] text-fg">{r.name}</p>
                  <p className="shrink-0 text-xs tabular text-fg-muted">{r.total}{r.overdue > 0 && <span className="text-danger"> · {r.overdue} overdue</span>}</p>
                </div>
                <Progress className="mt-1.5" value={(r.total / max) * 100} tone={r.total >= 8 ? "warning" : "default"} label={`${r.name} load`} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

