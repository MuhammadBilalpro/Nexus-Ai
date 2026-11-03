import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/stat";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { Bars } from "@/components/charts/charts";
import { cn } from "@/lib/utils";
import type { WorkloadPerson } from "@/features/insights/queries";

const HEAVY = 8;

export function WorkloadTable({ rows }: { rows: WorkloadPerson[] }) {
  const max = Math.max(1, ...rows.map((r) => r.open));
  return (
    <Card as="section" aria-labelledby="workload-table" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="workload-table">Open work per person</span>} description={`Tasks not yet done · ${HEAVY} or more open tasks is flagged`} />
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No assigned tasks" /></div>
      ) : (
        <div className="mt-3">
          <Table aria-label="Team workload">
            <THead>
              <tr>
                <TH>Person</TH>
                <TH className="w-44">Load</TH>
                <TH className="text-right">Open</TH>
                <TH className="text-right">In progress</TH>
                <TH className="text-right">Overdue</TH>
                <TH className="text-right">Due in 7 days</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.userId} interactive>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-fg">{r.name}</span>
                          {r.open >= HEAVY && <Badge tone="warning" dot>Heavy load</Badge>}
                        </div>
                        <span className="block truncate text-xs text-fg-subtle">{[r.title, r.department].filter(Boolean).join(" · ") || "—"}</span>
                      </div>
                    </div>
                  </TD>
                  <TD><Progress value={(r.open / max) * 100} tone={r.open >= HEAVY ? "warning" : "default"} label={`${r.name} ${r.open} open tasks`} /></TD>
                  <TD className="text-right tabular font-medium">{r.open}</TD>
                  <TD className="text-right tabular text-fg-muted">{r.inProgress}</TD>
                  <TD className={cn("text-right tabular", r.overdue ? "font-medium text-danger" : "text-fg-subtle")}>{r.overdue || "—"}</TD>
                  <TD className={cn("text-right tabular", r.dueSoon ? "text-fg" : "text-fg-subtle")}>{r.dueSoon || "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

export function WorkloadChart({ rows }: { rows: WorkloadPerson[] }) {
  return (
    <Card as="section" aria-labelledby="workload-chart">
      <CardHeader title={<span id="workload-chart">Open tasks per person</span>} description="Highest first" />
      {rows.length === 0 ? <EmptyState compact title="No assigned tasks" /> : <Bars ariaLabel="Open tasks per person" money={false} horizontal height={Math.max(160, rows.length * 32)} data={rows.map((r) => ({ label: r.name, open: r.open, color: r.open >= HEAVY ? "var(--warning)" : "var(--fg)" }))} dataKey="open" name="Open tasks" />}
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-fg-subtle">
        Capacity here is a count of assigned, unfinished tasks. It says how much is on someone&apos;s plate, not how well they work: tasks differ in size, and a heavy load is a planning signal to rebalance, not a performance judgement.
      </p>
    </Card>
  );
}
