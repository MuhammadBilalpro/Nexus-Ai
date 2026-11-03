import Link from "next/link";
import { Workflow as WorkflowIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/format";
import type { WorkflowListRow } from "../queries";
import { FlowStrip, RunStatusBadge } from "./step-visuals";
import { EnabledSwitch } from "./enabled-switch";

export function WorkflowList({ rows, canManage }: { rows: WorkflowListRow[]; canManage: boolean }) {
  if (rows.length === 0) {
    return (
      <EmptyState icon={WorkflowIcon} title="No workflows yet" description={canManage ? "Create a workflow to connect a trigger, an AI agent and an action." : "Workflows will appear here once an administrator creates them."} />
    );
  }
  return (
    <Card as="section" aria-label="Workflows" padded={false} className="overflow-hidden">
      <Table>
        <THead>
          <tr>
            <TH>Workflow</TH>
            <TH className="hidden lg:table-cell">Flow</TH>
            <TH>Enabled</TH>
            <TH className="hidden sm:table-cell">Last run</TH>
            <TH className="text-right">Runs</TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((w, idx) => (
            <TR key={w.id} interactive className="animate-fade-up" style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }}>
              <TD className="max-w-[360px]">
                <Link href={`/automation/${w.id}`} className="group block rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <p className="truncate text-[14px] font-medium text-fg group-hover:underline underline-offset-4">{w.name}</p>
                  {w.description && <p className="mt-0.5 truncate text-[13px] text-fg-muted">{w.description}</p>}
                  <div className="mt-1.5 lg:hidden"><FlowStrip steps={w.steps} /></div>
                </Link>
              </TD>
              <TD className="hidden lg:table-cell"><FlowStrip steps={w.steps} /></TD>
              <TD><EnabledSwitch workflowId={w.id} enabled={w.enabled} canManage={canManage} name={w.name} /></TD>
              <TD className="hidden sm:table-cell">
                {w.lastRun ? (
                  <div className="flex flex-col items-start gap-1">
                    <RunStatusBadge status={w.lastRun.status} />
                    <span className="text-xs text-fg-subtle">{w.lastRun.label}</span>
                  </div>
                ) : (
                  <span className="text-xs text-fg-subtle">Never run</span>
                )}
              </TD>
              <TD className="text-right tabular text-fg-muted">{formatNumber(w.runCount)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
