import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { Bars } from "@/components/charts/charts";
import { formatMoney, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ClientRow } from "@/features/insights/queries";

export function ClientsTable({ rows }: { rows: ClientRow[] }) {
  return (
    <Card as="section" aria-labelledby="clients-table" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="clients-table">Clients</span>} description="Lifetime paid revenue, open balances and pending decisions" />
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No clients yet" /></div>
      ) : (
        <div className="mt-3">
          <Table aria-label="Clients">
            <THead>
              <tr>
                <TH>Company</TH>
                <TH className="text-right">Active projects</TH>
                <TH className="text-right">Lifetime invoiced</TH>
                <TH className="text-right">Outstanding</TH>
                <TH className="text-right">Overdue</TH>
                <TH className="text-right">Pending approvals</TH>
                <TH>Last activity</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const overdue = r.overdue !== "0.00";
                return (
                  <TR key={r.id} interactive>
                    <TD>
                      <span className="font-medium text-fg">{r.company}</span>
                      {r.contact !== r.company && <span className="block text-xs text-fg-subtle">{r.contact}</span>}
                    </TD>
                    <TD className="text-right tabular">{r.activeProjects}</TD>
                    <TD className="text-right tabular font-medium">{formatMoney(r.lifetime)}</TD>
                    <TD className="text-right tabular text-fg-muted">{r.outstanding === "0.00" ? "—" : formatMoney(r.outstanding)}</TD>
                    <TD className={cn("text-right tabular", overdue ? "font-medium text-danger" : "text-fg-subtle")}>{overdue ? formatMoney(r.overdue) : "—"}</TD>
                    <TD className="text-right">{r.pendingApprovals ? <Badge tone="warning">{r.pendingApprovals} pending</Badge> : <span className="text-fg-subtle">—</span>}</TD>
                    <TD className="whitespace-nowrap text-fg-muted">{r.lastActivity ? formatRelative(r.lastActivity) : "—"}</TD>
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

export function ClientRevenueChart({ rows }: { rows: ClientRow[] }) {
  const data = rows.filter((r) => r.lifetime !== "0.00").map((r) => ({ label: r.company, revenue: Number(r.lifetime) }));
  return (
    <Card as="section" aria-labelledby="client-rev">
      <CardHeader title={<span id="client-rev">Revenue by client</span>} description="Lifetime paid invoices" />
      {data.length === 0 ? <EmptyState compact title="No paid invoices yet" /> : <Bars ariaLabel="Lifetime paid revenue per client" horizontal height={Math.max(140, data.length * 36)} data={data} dataKey="revenue" name="Revenue" />}
    </Card>
  );
}
