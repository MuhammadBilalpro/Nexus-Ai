import Link from "next/link";
import { Sparkles, Unplug } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/table";
import { formatNumber, humanize } from "@/lib/format";
import { AGENT_BOUNDARIES, AGENT_INTEGRATIONS, PERMISSION_MEANINGS, triggerLabel } from "../meta";
import { AgentStatusToggle } from "./agent-status-toggle";
import type { AgentDetailDTO } from "../queries";

const RUN_TONE = { SUCCEEDED: "success", AWAITING_APPROVAL: "warning", FAILED: "danger" } as const;

export function AgentIdentity({ agent, canManage }: { agent: AgentDetailDTO; canManage: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">Agent</p>
        <div className="mt-1.5 flex items-center gap-2.5">
          {agent.live && agent.status === "ACTIVE" && <span className="ai-dot" role="img" aria-label="Active in the last 24 hours" />}
          <h1 className="text-[22px] font-semibold tracking-tight text-fg sm:text-2xl">{agent.name}</h1>
          <Badge tone={agent.status === "ACTIVE" ? "success" : "neutral"} dot>{agent.status === "ACTIVE" ? "Active" : "Paused"}</Badge>
        </div>
        <p className="mt-1 text-[14px] text-fg-muted">{agent.purpose}</p>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-fg-muted">{agent.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href={`/assistant?agent=${agent.slug}`}>
          <Button variant="secondary" size="sm"><Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden /> Ask this agent</Button>
        </Link>
        {canManage && <AgentStatusToggle agentId={agent.id} status={agent.status} name={agent.name} />}
      </div>
    </div>
  );
}

export function AgentStats({ stats }: { stats: AgentDetailDTO["stats"] }) {
  return (
    <section aria-label="Run statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Runs" value={formatNumber(stats.total)} hint="all triggers" />
      <Stat label="Succeeded" value={formatNumber(stats.succeeded)} tone={stats.succeeded > 0 ? "success" : undefined} />
      <Stat label="Awaiting approval" value={formatNumber(stats.awaiting)} tone={stats.awaiting > 0 ? "warning" : undefined} hint="runs that produced proposals" />
      <Stat label="Failed" value={formatNumber(stats.failed)} tone={stats.failed > 0 ? "danger" : undefined} />
    </section>
  );
}

export function ExecutionHistory({ runs }: { runs: AgentDetailDTO["runs"] }) {
  return (
    <Card as="section" aria-labelledby="runs-heading" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="runs-heading">Execution history</span>} description="Every unit of work this agent has performed, newest first" />
      {runs.length === 0 ? (
        <div className="p-5"><EmptyState compact title="No runs yet" description="Runs appear when the agent answers a question or a schedule triggers it." /></div>
      ) : (
        <div className="mt-3">
          <Table className="text-[13px]">
            <THead>
              <tr>
                <TH>Started</TH>
                <TH>Trigger</TH>
                <TH>Summary</TH>
                <TH>Status</TH>
                <TH className="text-right">Duration</TH>
              </tr>
            </THead>
            <TBody>
              {runs.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap text-fg-subtle">{r.label}</TD>
                  <TD><Badge tone="outline">{triggerLabel(r.trigger)}</Badge></TD>
                  <TD className="min-w-[280px] text-fg">{r.summary}</TD>
                  <TD><Badge tone={RUN_TONE[r.status]} dot>{humanize(r.status)}</Badge></TD>
                  <TD className="text-right tabular text-fg-subtle">{r.durationMs === null ? "—" : r.durationMs >= 1000 ? `${(r.durationMs / 1000).toFixed(1)}s` : `${r.durationMs}ms`}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}

export function PermissionsCard({ agent }: { agent: AgentDetailDTO }) {
  const integrations = AGENT_INTEGRATIONS[agent.key] ?? [];
  return (
    <Card as="section" aria-labelledby="perm-heading">
      <CardHeader title={<span id="perm-heading">Permissions</span>} description="What this agent may read and propose" />
      <ul className="divide-y divide-line/60">
        {agent.permissions.map((p) => (
          <li key={p} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
            <code className="shrink-0 rounded-xs bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg">{p}</code>
            <span className="text-right text-[13px] text-fg-muted">{PERMISSION_MEANINGS[p] ?? p}</span>
          </li>
        ))}
        {agent.permissions.length === 0 && <li className="py-2 text-[13px] text-fg-subtle">No permissions granted.</li>}
      </ul>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Operational boundary</p>
        <ul className="mt-2 space-y-1.5">
          {AGENT_BOUNDARIES[agent.key].map((b) => (
            <li key={b} className="flex items-start gap-2 text-[13px] text-fg">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-fg-subtle" aria-hidden /> {b}
            </li>
          ))}
        </ul>
      </div>

      {integrations.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Integrations</p>
          <ul className="mt-2 space-y-2">
            {integrations.map((i) => (
              <li key={i.name} className="flex items-start gap-3 rounded-md border border-dashed border-line-strong px-3 py-2.5">
                <Unplug className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-fg">{i.name}: {i.connected ? "Connected" : "Not connected"}</p>
                  <p className="mt-0.5 text-xs text-fg-muted">{i.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
