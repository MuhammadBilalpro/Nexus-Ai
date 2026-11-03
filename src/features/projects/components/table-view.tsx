import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { ProjectStatus } from "@/generated/prisma/enums";
import { formatDate, formatMoney, humanize, categoryLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectListRow, SortKey } from "../queries";
import { HEALTH_TONE, STATUS_TONE, PROGRESS_TONE, daysLabel } from "./shared";

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "name", label: "Project" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "health", label: "Health" },
  { key: "progress", label: "Progress" },
  { key: "budget", label: "Budget", align: "right" },
  { key: "deadline", label: "Deadline" },
  { key: "manager", label: "Manager" },
  { key: "openTasks", label: "Open tasks", align: "right" },
];

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: ProjectStatus.PLANNING, label: "Planning" },
  { value: ProjectStatus.ACTIVE, label: "Active" },
  { value: ProjectStatus.ON_HOLD, label: "On hold" },
  { value: ProjectStatus.COMPLETED, label: "Completed" },
  { value: ProjectStatus.CANCELLED, label: "Cancelled" },
];

function href(params: { sort: SortKey; dir: "asc" | "desc"; status: string }): string {
  const p = new URLSearchParams({ view: "table", sort: params.sort, dir: params.dir });
  if (params.status) p.set("status", params.status);
  return `/projects?${p.toString()}`;
}

export function ProjectsTable({ rows, sort, dir, status, counts }: { rows: ProjectListRow[]; sort: SortKey; dir: "asc" | "desc"; status: string; counts: Record<string, number> }) {
  return (
    <Card as="section" aria-label="Projects table" padded={false}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-5 py-3" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => {
          const active = f.value === status;
          const n = f.value ? counts[f.value] ?? 0 : Object.values(counts).reduce((a, b) => a + b, 0);
          return (
            <Link key={f.value} href={href({ sort, dir, status: f.value })} scroll={false} aria-pressed={active} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors", active ? "border-fg bg-fg text-bg" : "border-line bg-surface text-fg-muted hover:border-line-strong hover:text-fg")}>
              {f.label}
              <span className={cn("tabular text-[11px]", active ? "text-bg/70" : "text-fg-subtle")}>{n}</span>
            </Link>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No projects match this filter" /></div>
      ) : (
        <Table>
          <THead>
            <tr>
              {COLUMNS.map((c) => {
                const active = c.key === sort;
                const nextDir = active && dir === "asc" ? "desc" : "asc";
                const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <TH key={c.key} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"} className={c.align === "right" ? "text-right" : undefined}>
                    <Link href={href({ sort: c.key, dir: nextDir, status })} scroll={false} className={cn("inline-flex items-center gap-1 rounded-xs hover:text-fg", active && "text-fg", c.align === "right" && "flex-row-reverse")}>
                      {c.label}
                      <Icon className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} aria-hidden />
                    </Link>
                  </TH>
                );
              })}
            </tr>
          </THead>
          <TBody>
            {rows.map((p) => (
              <TR key={p.id} interactive>
                <TD>
                  <Link href={`/projects/${p.slug}`} className="font-medium text-fg hover:underline underline-offset-4">{p.name}</Link>
                  {p.client && <span className="block text-xs text-fg-subtle">{p.client}</span>}
                </TD>
                <TD className="whitespace-nowrap text-fg-muted">{categoryLabel(p.category)}</TD>
                <TD><Badge tone={STATUS_TONE[p.status]}>{humanize(p.status)}</Badge></TD>
                <TD><Badge tone={HEALTH_TONE[p.health]} dot>{humanize(p.health)}</Badge></TD>
                <TD className="min-w-32">
                  <div className="flex items-center gap-2">
                    <Progress className="flex-1" value={p.progress} tone={PROGRESS_TONE[p.health]} label={`${p.name} progress ${p.progress}%`} />
                    <span className="w-9 text-right text-xs tabular text-fg-muted">{p.progress}%</span>
                  </div>
                </TD>
                <TD className="text-right tabular">{formatMoney(p.budget)}</TD>
                <TD className="whitespace-nowrap">
                  {p.deadline ? (
                    <>
                      <span className="text-fg-muted">{formatDate(p.deadline)}</span>
                      <span className={cn("block text-xs tabular", p.daysLeft !== null && p.daysLeft < 0 && p.status !== ProjectStatus.COMPLETED ? "text-danger" : "text-fg-subtle")}>{daysLabel(p.daysLeft, p.status === ProjectStatus.COMPLETED)}</span>
                    </>
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </TD>
                <TD className="whitespace-nowrap text-fg-muted">{p.manager?.name ?? "—"}</TD>
                <TD className="text-right tabular">{p.openTasks}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}
