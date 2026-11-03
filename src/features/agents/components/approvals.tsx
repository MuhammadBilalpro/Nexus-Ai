import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { humanize } from "@/lib/format";
import { riskTone } from "../meta";
import { DecisionButtons, StatusLabel } from "./decision-buttons";
import type { ProposedActionDTO } from "../queries";

export function PendingApprovalsList({ actions, canDecide, showAgent = true, title = "Pending approvals", description }: { actions: ProposedActionDTO[]; canDecide: boolean; showAgent?: boolean; title?: string; description?: string }) {
  return (
    <Card as="section" aria-labelledby="pending-heading" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="pending-heading">{title}</span>} description={description ?? `${actions.length === 0 ? "Nothing" : actions.length} waiting for a human decision. Nothing executes without one.`} />
      {actions.length === 0 ? (
        <div className="p-5"><EmptyState compact icon={ShieldCheck} title="No pending approvals" description="Agents will propose actions here as they find things worth doing." /></div>
      ) : (
        <ol className="mt-3 divide-y divide-line">
          {actions.map((a, i) => (
            <li key={a.id} className="px-5 py-4 animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {showAgent && (
                      <Link href={`/agents/${a.agentSlug}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-fg">
                        <span className="ai-dot" aria-hidden /> {a.agentName}
                      </Link>
                    )}
                    <Badge tone={riskTone(a.risk)}>{humanize(a.risk)} risk</Badge>
                    <span className="text-xs text-fg-subtle">{a.createdLabel}</span>
                  </div>
                  <p className="mt-1.5 text-[14px] font-medium leading-snug text-fg">{a.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{a.rationale}</p>
                  {a.payloadSummary && <p className="mt-1.5 truncate text-xs text-fg-subtle"><span className="text-fg-muted">{humanize(a.kind)}</span> · {a.payloadSummary}</p>}
                </div>
                <div className="shrink-0 sm:pt-1">
                  <DecisionButtons actionId={a.id} status={a.status} canDecide={canDecide} title={a.title} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function ApprovalHistory({ actions, showAgent = true }: { actions: ProposedActionDTO[]; showAgent?: boolean }) {
  return (
    <Card as="section" aria-labelledby="history-heading" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="history-heading">Decision history</span>} description="Approved and rejected proposals, newest first" />
      {actions.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No decisions yet" /></div>
      ) : (
        <div className="mt-3">
          <Table className="text-[13px]">
            <THead>
              <tr>
                {showAgent && <TH>Agent</TH>}
                <TH>Proposal</TH>
                <TH>Risk</TH>
                <TH>Decision</TH>
                <TH>Decided</TH>
              </tr>
            </THead>
            <TBody>
              {actions.map((a) => (
                <TR key={a.id} className="text-fg-muted">
                  {showAgent && <TD className="whitespace-nowrap">{a.agentName}</TD>}
                  <TD className="min-w-[240px]"><span className="text-fg">{a.title}</span><span className="block text-xs text-fg-subtle">{humanize(a.kind)}</span></TD>
                  <TD><Badge tone={riskTone(a.risk)}>{humanize(a.risk)}</Badge></TD>
                  <TD><StatusLabel status={a.status} /></TD>
                  <TD className="whitespace-nowrap text-fg-subtle">{a.decidedLabel ?? "—"}{a.decidedBy ? ` · ${a.decidedBy}` : ""}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
