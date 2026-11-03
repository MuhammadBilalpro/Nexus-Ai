import Link from "next/link";
import { addMonths, differenceInCalendarDays, format, startOfMonth } from "date-fns";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectStatus, type ProjectHealth, type MilestoneStatus } from "@/generated/prisma/enums";
import { formatDate, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectListRow } from "../queries";
import { HEALTH_TONE } from "./shared";

const MONTHS_BACK = 2;
const MONTHS_AHEAD = 8;
const LABEL_W = 220; // px, sticky project label column

const BAR: Record<ProjectHealth, string> = { ON_TRACK: "bg-fg", AT_RISK: "bg-warning", DELAYED: "bg-danger" };
const DIAMOND: Record<MilestoneStatus, string> = { PLANNED: "bg-surface border-fg-muted", IN_PROGRESS: "bg-surface border-fg", COMPLETED: "bg-success border-success", MISSED: "bg-danger border-danger" };

/**
 * A plain-div Gantt. The server computes every percentage from `now` so the
 * client renders nothing time-dependent.
 */
export function Timeline({ rows, now }: { rows: ProjectListRow[]; now: Date }) {
  const start = startOfMonth(addMonths(now, -MONTHS_BACK));
  const end = startOfMonth(addMonths(now, MONTHS_AHEAD + 1));
  const total = differenceInCalendarDays(end, start);
  const pct = (d: Date) => Math.max(0, Math.min(100, (differenceInCalendarDays(d, start) / total) * 100));
  const months = Array.from({ length: MONTHS_BACK + MONTHS_AHEAD + 1 }, (_, i) => startOfMonth(addMonths(start, i)));
  const todayPct = pct(now);

  const items = rows
    .filter((r) => r.status !== ProjectStatus.CANCELLED && (r.startDate || r.deadline))
    .map((r) => {
      const s = r.startDate ?? r.deadline!;
      const e = r.deadline ?? r.startDate!;
      const clippedStart = s < start;
      const clippedEnd = e > end;
      const left = pct(s);
      const right = pct(e);
      return { r, left, width: Math.max(0.6, right - left), clippedStart, clippedEnd, s, e };
    })
    .sort((a, b) => a.s.getTime() - b.s.getTime());

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState title="No scheduled projects" description="Projects appear on the timeline once they have a start date or a deadline." />
      </Card>
    );
  }

  return (
    <Card as="section" aria-labelledby="timeline-heading" padded={false} className="overflow-hidden">
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="timeline-heading">Timeline</span>} description={`${format(start, "MMM yyyy")} to ${format(addMonths(end, -1), "MMM yyyy")} · bars run from start date to deadline, diamonds are milestones`} />
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 px-5 text-[11px] text-fg-subtle" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-fg" /> On track</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-warning" /> At risk</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-danger" /> Delayed</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 border border-fg bg-surface" /> Milestone</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-px bg-accent" /> Today</span>
      </div>
      <div className="mt-3 overflow-x-auto scrollbar-thin">
        <div className="min-w-[960px]" role="table" aria-label="Project timeline">
          {/* Month header */}
          <div role="row" className="flex border-y border-line bg-surface-2/60 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
            <div role="columnheader" className="sticky left-0 z-10 shrink-0 border-r border-line bg-surface-2 px-5 py-2" style={{ width: LABEL_W }}>Project</div>
            <div className="relative flex flex-1">
              {months.map((m) => (
                <div key={m.toISOString()} role="columnheader" className={cn("flex-1 border-r border-line px-2 py-2 last:border-r-0", m.getMonth() === now.getMonth() && m.getFullYear() === now.getFullYear() && "text-fg")}>
                  {format(m, "MMM")}<span className="ml-1 normal-case tracking-normal text-fg-subtle/70">{format(m, "yy")}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Rows */}
          <div role="rowgroup" className="relative">
            {items.map(({ r, left, width, clippedStart, clippedEnd, s, e }, idx) => (
              <div key={r.id} role="row" className="group flex border-b border-line last:border-b-0 hover:bg-surface-2/40 animate-fade-in" style={{ animationDelay: `${idx * 25}ms` }}>
                <div role="rowheader" className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-line bg-surface px-5 py-3 group-hover:bg-surface-2" style={{ width: LABEL_W }}>
                  <div className="min-w-0">
                    <Link href={`/projects/${r.slug}`} className="block truncate text-[13px] font-medium text-fg hover:underline underline-offset-4">{r.name}</Link>
                    <p className="truncate text-[11px] text-fg-subtle">{formatDate(s, "short")} → {formatDate(e, "short")}</p>
                  </div>
                  <Badge tone={HEALTH_TONE[r.health]} className="ml-auto hidden xl:inline-flex">{humanize(r.health)}</Badge>
                </div>
                <div role="cell" className="relative flex-1 py-3">
                  {/* month gridlines */}
                  <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
                    {months.map((m) => <div key={m.toISOString()} className="flex-1 border-r border-line/60 last:border-r-0" />)}
                  </div>
                  {/* bar */}
                  <div className="relative h-5">
                    <div
                      className={cn("absolute top-1/2 h-2 -translate-y-1/2 rounded-full opacity-80 transition-opacity group-hover:opacity-100", BAR[r.health], r.status === ProjectStatus.COMPLETED && "opacity-40", clippedStart && "rounded-l-none", clippedEnd && "rounded-r-none")}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${r.name}: ${formatDate(s)} to ${formatDate(e)} · ${r.progress}% · ${humanize(r.health)}`}
                      role="img"
                      aria-label={`${r.name}, ${formatDate(s)} to ${formatDate(e)}, ${r.progress}% complete, ${humanize(r.health)}`}
                    />
                    {/* unfinished share of the bar is lightened */}
                    {r.status !== ProjectStatus.COMPLETED && (
                      <div className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-bg/40" style={{ left: `${left + (width * r.progress) / 100}%`, width: `${width - (width * r.progress) / 100}%` }} aria-hidden />
                    )}
                    {/* milestones */}
                    {r.milestones
                      .filter((m) => m.dueDate >= start && m.dueDate <= end)
                      .map((m) => (
                        <span key={m.id} className="group/ms absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2" style={{ left: `${pct(m.dueDate)}%` }}>
                          <span
                            tabIndex={0}
                            role="img"
                            aria-label={`Milestone ${m.title}, ${humanize(m.status)}, due ${formatDate(m.dueDate)}`}
                            title={`${m.title} · ${humanize(m.status)} · ${formatDate(m.dueDate)}`}
                            className={cn("block h-2.5 w-2.5 rotate-45 rounded-[2px] border shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", DIAMOND[m.status])}
                          />
                          <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-sm border border-line bg-surface px-2 py-1 text-[11px] text-fg shadow-md group-hover/ms:block group-focus-within/ms:block">
                            <span className="font-medium">{m.title}</span>
                            <span className="text-fg-muted"> · {humanize(m.status)} · {formatDate(m.dueDate, "short")}</span>
                          </span>
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            ))}
            {/* today marker across all rows */}
            <div className="pointer-events-none absolute inset-y-0" style={{ left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${todayPct / 100})` }} aria-hidden>
              <div className="h-full w-px bg-accent" />
              <span className="absolute -top-0 left-1.5 rounded-xs bg-accent-soft px-1 text-[10px] font-medium text-accent">Today</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
