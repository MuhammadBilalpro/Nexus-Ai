import Link from "next/link";
import { CalendarDays, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { ProjectStatus } from "@/generated/prisma/enums";
import { formatDate, humanize, categoryLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectListRow } from "../queries";
import { ProjectStatusSelect } from "./controls";
import { HEALTH_TONE, PROGRESS_TONE, daysLabel } from "./shared";

const COLUMNS: { status: ProjectStatus; label: string; hint: string }[] = [
  { status: ProjectStatus.PLANNING, label: "Planning", hint: "Scoped, not started" },
  { status: ProjectStatus.ACTIVE, label: "Active", hint: "In delivery" },
  { status: ProjectStatus.ON_HOLD, label: "On hold", hint: "Paused" },
  { status: ProjectStatus.COMPLETED, label: "Completed", hint: "Delivered" },
];

export function Board({ rows, canMove }: { rows: ProjectListRow[]; canMove: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" role="list" aria-label="Projects by status">
      {COLUMNS.map((col) => {
        const items = rows.filter((r) => r.status === col.status);
        return (
          <section key={col.status} role="listitem" aria-labelledby={`col-${col.status}`} className="flex min-h-[160px] flex-col rounded-lg border border-line bg-surface-2/50 p-2">
            <header className="flex items-baseline justify-between px-2 pb-2 pt-1">
              <div>
                <h2 id={`col-${col.status}`} className="text-[13px] font-semibold text-fg">{col.label}</h2>
                <p className="text-[11px] text-fg-subtle">{col.hint}</p>
              </div>
              <span className="text-xs tabular text-fg-muted" aria-label={`${items.length} projects`}>{items.length}</span>
            </header>
            <ul className="flex flex-1 flex-col gap-2">
              {items.length === 0 && <li className="flex flex-1 items-center justify-center rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-fg-subtle">Nothing here</li>}
              {items.map((p, idx) => (
                <li key={p.id} className="animate-fade-up" style={{ animationDelay: `${idx * 30}ms` }}>
                  <article className="surface p-3.5 transition-[border-color] duration-150 hover:border-line-strong" aria-labelledby={`card-${p.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link id={`card-${p.id}`} href={`/projects/${p.slug}`} className="block truncate text-[14px] font-medium text-fg hover:underline underline-offset-4">{p.name}</Link>
                        <p className="mt-0.5 truncate text-xs text-fg-subtle">{categoryLabel(p.category)}{p.client ? ` · ${p.client}` : ""}</p>
                      </div>
                      <Badge tone={HEALTH_TONE[p.health]} dot className="shrink-0">{humanize(p.health)}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Progress className="flex-1" value={p.progress} tone={PROGRESS_TONE[p.health]} label={`${p.name} progress ${p.progress}%`} />
                      <span className="w-8 text-right text-[11px] tabular text-fg-muted">{p.progress}%</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-fg-muted">
                      <span className="flex items-center gap-1.5" title={p.manager?.name ?? "No manager"}>
                        <Avatar name={p.manager?.name} size="xs" />
                        <span className="truncate">{p.manager?.name?.split(" ")[0] ?? "Unassigned"}</span>
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center gap-1 tabular" title="Open tasks"><ListTodo className="h-3 w-3" aria-hidden /> {p.openTasks}<span className="sr-only"> open tasks</span></span>
                        {p.deadline && (
                          <span className={cn("inline-flex items-center gap-1 tabular", p.daysLeft !== null && p.daysLeft < 0 && p.status !== ProjectStatus.COMPLETED ? "text-danger" : "")} title={daysLabel(p.daysLeft, p.status === ProjectStatus.COMPLETED)}>
                            <CalendarDays className="h-3 w-3" aria-hidden /> {formatDate(p.deadline, "short")}
                          </span>
                        )}
                      </span>
                    </div>
                    {canMove && <ProjectStatusSelect className="mt-3" projectId={p.id} status={p.status} name={p.name} />}
                  </article>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
