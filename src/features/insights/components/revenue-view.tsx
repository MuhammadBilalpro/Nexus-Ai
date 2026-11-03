import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { AreaTrend, Bars } from "@/components/charts/charts";
import { formatMoney, formatDate, humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RevenuePoint } from "@/features/dashboard/queries/overview";
import type { RevenueStats, RevenueByProject, ReceivableRow } from "@/features/insights/queries";
import { INVOICE_TONE } from "./shared";

export function RevenueStatsRow({ s }: { s: RevenueStats }) {
  return (
    <section aria-label="Revenue metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Revenue this month" value={formatMoney(s.monthRevenue)} hint="paid invoices, month to date" />
      <Stat label="Last 30 days" value={formatMoney(s.last30.value)} delta={s.last30.delta} hint="vs. prior 30 days" />
      <Stat label="Outstanding receivables" value={formatMoney(s.outstanding)} hint={`${s.outstandingCount} ${s.outstandingCount === 1 ? "invoice" : "invoices"} sent, unpaid`} />
      <Stat label="Overdue" value={formatMoney(s.overdue)} hint={s.overdueCount ? `${s.overdueCount} past due date` : "nothing past due"} tone={s.overdueCount ? "danger" : undefined} />
    </section>
  );
}

export function RevenueTrendCard({ data }: { data: RevenuePoint[] }) {
  const points = data.map((d) => ({ label: d.month, revenue: Number(d.revenue), expenses: Number(d.expenses) }));
  const hasData = points.some((p) => p.revenue > 0 || p.expenses > 0);
  return (
    <Card as="section" aria-labelledby="rev-trend">
      <CardHeader title={<span id="rev-trend">Revenue and expenses</span>} description="Paid invoices against recorded expenses, by month, last 12 months" />
      {hasData ? <AreaTrend ariaLabel="Monthly revenue and expenses, last 12 months" data={points} series={[{ key: "revenue", name: "Revenue" }, { key: "expenses", name: "Expenses", muted: true }]} /> : <EmptyState compact title="No financial records yet" />}
    </Card>
  );
}

export function RevenueByProjectCard({ rows }: { rows: RevenueByProject[] }) {
  return (
    <Card as="section" aria-labelledby="rev-proj">
      <CardHeader title={<span id="rev-proj">Revenue by project</span>} description="Paid invoices, top 8 projects" />
      {rows.length === 0 ? (
        <EmptyState compact title="No paid invoices yet" />
      ) : (
        <Bars ariaLabel="Paid revenue per project" horizontal height={Math.max(160, rows.length * 34)} data={rows.map((r) => ({ label: r.name.length > 26 ? `${r.name.slice(0, 25)}…` : r.name, revenue: Number(r.revenue) }))} dataKey="revenue" name="Revenue" />
      )}
    </Card>
  );
}

export function ReceivablesTable({ rows }: { rows: ReceivableRow[] }) {
  return (
    <Card as="section" aria-labelledby="receivables" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="receivables">Invoices and receivables</span>} description="Overdue first, then sent, drafts and recently paid" />
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No invoices recorded" /></div>
      ) : (
        <div className="mt-3">
          <Table aria-label="Invoices">
            <THead>
              <tr>
                <TH>Invoice</TH>
                <TH>Client</TH>
                <TH className="text-right">Amount</TH>
                <TH>Issued</TH>
                <TH>Due</TH>
                <TH>Status</TH>
                <TH className="text-right">Days overdue</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id} interactive>
                  <TD>
                    <span className="font-medium text-fg">{r.number}</span>
                    {r.project && (
                      <span className="block truncate text-xs text-fg-subtle">{r.projectSlug ? <Link href={`/projects/${r.projectSlug}`} className="hover:text-fg hover:underline underline-offset-4">{r.project}</Link> : r.project}</span>
                    )}
                  </TD>
                  <TD className="text-fg-muted">{r.client}</TD>
                  <TD className="text-right tabular font-medium">{formatMoney(r.amount)}</TD>
                  <TD className="whitespace-nowrap text-fg-muted">{formatDate(r.issuedAt)}</TD>
                  <TD className={cn("whitespace-nowrap", r.daysOverdue > 0 ? "text-danger" : "text-fg-muted")}>{formatDate(r.dueAt)}</TD>
                  <TD><Badge tone={INVOICE_TONE[r.status]} dot>{humanize(r.status)}</Badge></TD>
                  <TD className={cn("text-right tabular", r.daysOverdue > 0 ? "font-medium text-danger" : "text-fg-subtle")}>{r.daysOverdue > 0 ? r.daysOverdue : "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
