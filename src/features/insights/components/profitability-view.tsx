import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat, Progress } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { Bars } from "@/components/charts/charts";
import { formatMoney, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProfitabilityData } from "@/features/insights/queries";
import { STATUS_TONE } from "./shared";

export function ProfitabilityStats({ d }: { d: ProfitabilityData }) {
  const netNegative = d.netMonth.startsWith("-");
  return (
    <section aria-label="Profitability metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Gross margin" value={d.grossMargin === null ? "—" : `${d.grossMargin}%`} hint={`${formatMoney(d.totalRevenue)} paid · ${formatMoney(d.totalExpenses)} spent`} tone={d.grossMargin !== null && d.grossMargin < 0 ? "danger" : undefined} />
      <Stat label="Net this month" value={formatMoney(d.netMonth)} hint="paid revenue minus expenses, month to date" tone={netNegative ? "danger" : undefined} />
      <Stat label="Best margin" value={d.best ? `${d.best.margin}%` : "—"} hint={d.best ? <Link href={`/projects/${d.best.slug}`} className="hover:text-fg hover:underline underline-offset-4">{d.best.name}</Link> : "no invoiced projects"} tone={d.best ? "success" : undefined} />
      <Stat label="Worst margin" value={d.worst ? `${d.worst.margin}%` : "—"} hint={d.worst ? <Link href={`/projects/${d.worst.slug}`} className="hover:text-fg hover:underline underline-offset-4">{d.worst.name}</Link> : "needs two or more projects"} tone={d.worst && d.worst.margin < 0 ? "danger" : d.worst && d.worst.margin < 20 ? "warning" : undefined} />
    </section>
  );
}

export function ProfitabilityTable({ rows }: { rows: ProfitabilityData["rows"] }) {
  return (
    <Card as="section" aria-labelledby="profit-table" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="profit-table">Margin by project</span>} description="Paid invoices against recorded expenses; spend bar shows expenses against budget" />
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No projects" /></div>
      ) : (
        <div className="mt-3">
          <Table aria-label="Project profitability">
            <THead>
              <tr>
                <TH>Project</TH>
                <TH className="text-right">Budget</TH>
                <TH className="text-right">Invoiced</TH>
                <TH className="text-right">Expenses</TH>
                <TH className="text-right">Net</TH>
                <TH className="text-right">Margin</TH>
                <TH className="w-40">Spend vs budget</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const neg = r.net.startsWith("-");
                return (
                  <TR key={r.id} interactive>
                    <TD>
                      <Link href={`/projects/${r.slug}`} className="font-medium text-fg hover:underline underline-offset-4">{r.name}</Link>
                      <span className="ml-2 inline-block align-middle"><Badge tone={STATUS_TONE[r.status]}>{humanize(r.status)}</Badge></span>
                    </TD>
                    <TD className="text-right tabular text-fg-muted">{formatMoney(r.budget)}</TD>
                    <TD className="text-right tabular">{formatMoney(r.invoiced)}</TD>
                    <TD className="text-right tabular text-fg-muted">{formatMoney(r.expenses)}</TD>
                    <TD className={cn("text-right tabular font-medium", neg && "text-danger")}>{formatMoney(r.net)}</TD>
                    <TD className={cn("text-right tabular", r.margin === null ? "text-fg-subtle" : r.margin < 0 ? "text-danger" : r.margin < 20 ? "text-warning" : "text-fg")}>{r.margin === null ? "—" : `${r.margin}%`}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Progress className="flex-1" value={r.spendPercent} tone={r.spendPercent >= 100 ? "danger" : r.spendPercent >= 80 ? "warning" : "default"} label={`${r.name} spend ${r.spendPercent}% of budget`} />
                        <span className="w-9 text-right text-xs tabular text-fg-muted">{r.spendPercent}%</span>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

export function MarginChart({ rows }: { rows: ProfitabilityData["rows"] }) {
  const data = rows.filter((r) => r.margin !== null).map((r) => ({ label: r.name.length > 26 ? `${r.name.slice(0, 25)}…` : r.name, margin: r.margin as number }));
  return (
    <Card as="section" aria-labelledby="margin-chart">
      <CardHeader title={<span id="margin-chart">Margin per project</span>} description="Percent of paid revenue retained after expenses; negative margins in red" />
      {data.length === 0 ? <EmptyState compact title="No invoiced projects" /> : <Bars ariaLabel="Margin percent per project" money={false} horizontal height={Math.max(160, data.length * 34)} data={data.map((p) => ({ ...p, color: Number(p.margin) < 0 ? "var(--danger)" : Number(p.margin) < 20 ? "var(--warning)" : "var(--fg)" }))} dataKey="margin" name="Margin %" />}
    </Card>
  );
}
