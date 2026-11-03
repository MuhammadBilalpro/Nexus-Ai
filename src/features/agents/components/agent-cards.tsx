import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { PERMISSION_MEANINGS } from "../meta";
import type { AgentCardDTO } from "../queries";

const RUN_TONE = { SUCCEEDED: "success", AWAITING_APPROVAL: "warning", FAILED: "danger" } as const;

export function AgentGrid({ agents }: { agents: AgentCardDTO[] }) {
  if (agents.length === 0) return <EmptyState title="No agents provisioned" description="Agents are created by the seed or by an administrator." />;
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Agents">
      {agents.map((a, i) => (
        <li key={a.id} className="animate-fade-up" style={{ animationDelay: `${i * 50}ms` }}>
          <Link href={`/agents/${a.slug}`} className="group block h-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`${a.name}: open agent`}>
            <Card interactive className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {a.live && a.status === "ACTIVE" && <span className="ai-dot" aria-label="Active in the last 24 hours" role="img" />}
                    <h3 className="truncate text-[15px] font-semibold text-fg">{a.name}</h3>
                  </div>
                  <p className="mt-0.5 text-[13px] text-fg-muted">{a.purpose}</p>
                </div>
                <Badge tone={a.status === "ACTIVE" ? "success" : "neutral"} dot>{a.status === "ACTIVE" ? "Active" : "Paused"}</Badge>
              </div>

              <div className="mt-4 rounded-md border border-line bg-surface-2/60 px-3 py-2.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Current activity</p>
                {a.latestRun ? (
                  <>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-fg">{a.latestRun.summary}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-subtle">
                      <span className={cn("h-1.5 w-1.5 rounded-full", a.latestRun.status === "SUCCEEDED" ? "bg-success" : a.latestRun.status === "FAILED" ? "bg-danger" : "bg-warning")} aria-hidden />
                      <span className="sr-only">{a.latestRun.status.toLowerCase().replace("_", " ")} · </span>
                      {a.latestRun.label}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] text-fg-subtle">No runs recorded yet.</p>
                )}
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <dt className="text-fg-subtle">Tasks completed</dt>
                  <dd className="mt-0.5 text-[15px] font-semibold tabular text-fg">{a.completed}</dd>
                </div>
                <div>
                  <dt className="text-fg-subtle">Pending approvals</dt>
                  <dd className={cn("mt-0.5 text-[15px] font-semibold tabular", a.pendingApprovals > 0 ? "text-warning" : "text-fg")}>{a.pendingApprovals}</dd>
                </div>
              </dl>

              <div className="mt-4 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Permissions</p>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {a.permissions.slice(0, 4).map((p) => (
                    <li key={p}>
                      <Badge tone="outline" title={PERMISSION_MEANINGS[p]}>{p}</Badge>
                    </li>
                  ))}
                  {a.permissions.length > 4 && <li><Badge tone="outline">+{a.permissions.length - 4}</Badge></li>}
                </ul>
              </div>

              <p className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-fg-muted transition-colors group-hover:text-fg">
                Open agent <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export { RUN_TONE };
