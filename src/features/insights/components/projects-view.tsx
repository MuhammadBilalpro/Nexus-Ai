import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat, Progress } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { LineTrend } from "@/components/charts/charts";
import { formatDate, formatNumber, humanize, categoryLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectPerformanceData } from "@/features/insights/queries";
import { HEALTH_TONE, STATUS_TONE, daysLabel } from "./shared";

export function ProjectStats({ d }: { d: ProjectPerformanceData }) {
  return (
    <section aria-label="Project delivery metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="On track" value={formatNumber(d.onTrack)} hint="active, planned or on-hold projects" tone={d.onTrack ? "success" : undefined} />
      <Stat label="At risk" value={formatNumber(d.atRisk)} hint="over a quarter of open tasks overdue" tone={d.atRisk ? "warning" : undefined} />
      <Stat label="Delayed" value={formatNumber(d.delayed)} hint="past deadline or missed milestone" tone={d.delayed ? "danger" : undefined} />
      <Stat label="Average progress" value={d.averageProgress === null ? "—" : `${d.averageProgress}%`} hint="across live projects" />
    </section>
  );
}

export function ThroughputCard({ weekly }: { weekly: ProjectPerformanceData["weekly"] }) {
  const total = weekly.reduce((a, w) => a + w.completed, 0);
  return (
    <Card as="section" aria-labelledby="throughput">
      <CardHeader title={<span id="throughput">Tasks completed per week</span>} description={`Last 8 weeks · ${total} tasks closed`} />
      {total === 0 ? <EmptyState compact title="No tasks completed in the last 8 weeks" /> : <LineTrend ariaLabel="Tasks completed per week, last 8 weeks" height={200} data={weekly.map((w) => ({ label: w.label, completed: w.completed }))} series={[{ key: "completed", name: "Completed", color: "var(--fg)" }]} />}
    </Card>
  );
}

export function PerformanceTable({ rows }: { rows: ProjectPerformanceData["rows"] }) {
  return (
    <Card as="section" aria-labelledby="perf-table" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="perf-table">Project performance</span>} description="All projects except cancelled" />
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No projects yet" /></div>
      ) : (
        <div className="mt-3">
          <Table aria-label="Project performance">
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>Status</TH>
                <TH>Health</TH>
                <TH className="w-36">Progress</TH>
                <TH>Deadline</TH>
                <TH className="text-right">Open</TH>
                <TH className="text-right">Done</TH>
                <TH className="text-right">Milestones</TH>
                <TH>Manager</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id} interactive>
                  <TD>
                    <Link href={`/projects/${r.slug}`} className="font-medium text-fg hover:underline underline-offset-4">{r.name}</Link>
                    <span className="block text-xs text-fg-subtle">{categoryLabel(r.category)}</span>
                  </TD>
                  <TD><Badge tone={STATUS_TONE[r.status]}>{humanize(r.status)}</Badge></TD>
                  <TD><Badge tone={HEALTH_TONE[r.health]} dot>{humanize(r.health)}</Badge></TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Progress className="flex-1" value={r.progress} tone={r.health === "DELAYED" ? "danger" : r.health === "AT_RISK" ? "warning" : "default"} label={`${r.name} progress ${r.progress}%`} />
                      <span className="w-9 text-right text-xs tabular text-fg-muted">{r.progress}%</span>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {r.deadline ? (
                      <>
                        <span className="text-fg-muted">{formatDate(r.deadline)}</span>
                        <span className={cn("block text-xs tabular", r.daysLeft !== null && r.daysLeft < 0 && r.status !== "COMPLETED" ? "text-danger" : "text-fg-subtle")}>{r.status === "COMPLETED" ? "delivered" : daysLabel(r.daysLeft)}</span>
                      </>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </TD>
                  <TD className="text-right tabular">{r.openTasks}</TD>
                  <TD className="text-right tabular text-fg-muted">{r.doneTasks}</TD>
                  <TD className="text-right tabular">
                    <span className="text-success">{r.milestonesHit}</span>
                    <span className="text-fg-subtle"> / </span>
                    <span className={r.milestonesMissed ? "text-danger" : "text-fg-subtle"}>{r.milestonesMissed}</span>
                    <span className="block text-[10px] uppercase tracking-wide text-fg-subtle">hit / missed</span>
                  </TD>
                  <TD className="whitespace-nowrap text-fg-muted">{r.manager ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
