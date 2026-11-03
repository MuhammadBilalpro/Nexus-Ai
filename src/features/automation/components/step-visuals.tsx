import type { LucideIcon } from "lucide-react";
import { Zap, GitBranch, Bot, Send } from "lucide-react";
import { StepKind } from "@/generated/prisma/enums";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KIND_LABEL } from "../catalog";
import type { RunStatus } from "../queries";

export const KIND_ICON: Record<StepKind, LucideIcon> = {
  [StepKind.TRIGGER]: Zap,
  [StepKind.CONDITION]: GitBranch,
  [StepKind.AGENT]: Bot,
  [StepKind.ACTION]: Send,
};

export function KindIcon({ kind, className }: { kind: StepKind; className?: string }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className={cn("inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-line bg-surface-2", kind === StepKind.AGENT ? "text-accent" : "text-fg-muted", className)} aria-hidden>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export function KindEyebrow({ kind }: { kind: StepKind }) {
  return (
    <p className={cn("flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em]", kind === StepKind.AGENT ? "text-accent" : "text-fg-subtle")}>
      {kind === StepKind.AGENT && <span className="ai-dot" aria-hidden />}
      {KIND_LABEL[kind]}
    </p>
  );
}

const RUN_TONE: Record<RunStatus, BadgeTone> = { succeeded: "success", failed: "danger", awaiting_approval: "warning" };
const RUN_LABEL: Record<RunStatus, string> = { succeeded: "Succeeded", failed: "Failed", awaiting_approval: "Awaiting approval" };

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Badge tone={RUN_TONE[status]} dot>{RUN_LABEL[status]}</Badge>;
}

/** Compact chip row: trigger → condition → agent → action. */
export function FlowStrip({ steps, className }: { steps: { id: string; kind: StepKind; label: string; connected: boolean }[]; className?: string }) {
  if (steps.length === 0) return <span className="text-xs text-fg-subtle">No steps yet</span>;
  return (
    <ol className={cn("flex flex-wrap items-center gap-1", className)} aria-label="Workflow steps">
      {steps.map((s, i) => {
        const Icon = KIND_ICON[s.kind];
        return (
          <li key={s.id} className="flex items-center gap-1">
            {i > 0 && <span className="h-px w-2.5 bg-line-strong" aria-hidden />}
            <span
              className={cn("inline-flex h-6 items-center gap-1 rounded-xs border px-1.5 text-[11px]", s.kind === StepKind.AGENT ? "border-accent/30 bg-accent-soft text-accent" : "border-line bg-surface-2 text-fg-muted", !s.connected && "border-dashed border-warning/50 text-warning")}
              title={`${KIND_LABEL[s.kind]}: ${s.label}${s.connected ? "" : " (not connected)"}`}
              aria-label={`${KIND_LABEL[s.kind]}: ${s.label}${s.connected ? "" : ", not connected"}`}
            >
              <Icon className="h-3 w-3" aria-hidden />
              <span className="hidden max-w-[120px] truncate md:inline">{s.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
