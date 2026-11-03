"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { AreaTrend, Bars } from "@/components/charts/charts";
import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DecisionButtons } from "@/features/agents/components/decision-buttons";
import type { StructuredAnswer } from "../types";

const RISK_TONE = { low: "neutral", medium: "warning", high: "danger" } as const;

/**
 * Renders one structured answer. Every section maps to a field the engine
 * filled from records; absent fields render nothing rather than placeholders.
 */
export function AssistantAnswer({ answer, canDecide, onFollowUp, animate = false }: { answer: StructuredAnswer; canDecide: boolean; onFollowUp: (q: string) => void; animate?: boolean }) {
  const hasChart = answer.series && answer.series.data.some((d) => d.value !== 0);
  return (
    <article className={cn("max-w-3xl", animate && "animate-fade-up")} aria-label={`Answer from ${answer.agentName}`}>
      <div className="flex items-center gap-2 text-xs">
        <span className="ai-dot" aria-hidden />
        <span className="font-medium text-fg">{answer.agentName}</span>
        <span className="text-fg-subtle">·</span>
        <span className="text-fg-subtle">Answered from records</span>
      </div>

      <p className="mt-2.5 text-[15px] leading-relaxed text-fg">{answer.summary}</p>

      {answer.facts.length > 0 && (
        <section className="mt-4 surface overflow-hidden" aria-label="Key facts">
          <p className="border-b border-line px-4 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Key facts</p>
          <dl className="divide-y divide-line/70">
            {answer.facts.map((f, i) => (
              <div key={`${f.label}-${i}`} className="flex items-baseline justify-between gap-4 px-4 py-2 text-[13px]">
                <dt className="shrink-0 text-fg-muted">{f.label}</dt>
                <dd className="min-w-0 text-right tabular text-fg">
                  {f.href ? (
                    <Link href={f.href} className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                      <span className="truncate">{f.value}</span>
                      <ArrowUpRight className="h-3 w-3 shrink-0 text-fg-subtle" aria-hidden />
                      <span className="sr-only">(open record)</span>
                    </Link>
                  ) : (
                    f.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {hasChart && answer.series && (
        <section className="mt-3 surface p-4" aria-label={`${answer.series.name} chart`}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">{answer.series.name}</p>
          {answer.series.type === "area" ? (
            <AreaTrend ariaLabel={`${answer.series.name} over time`} data={answer.series.data.map((d) => ({ label: d.label, value: d.value }))} series={[{ key: "value", name: answer.series.name }]} money={answer.series.money} height={180} />
          ) : (
            <Bars ariaLabel={`${answer.series.name} by item`} data={answer.series.data.map((d) => ({ label: d.label, value: d.value, color: d.value < 0 ? "var(--danger)" : "var(--fg)" }))} dataKey="value" name={answer.series.name} money={answer.series.money} height={Math.max(140, answer.series.data.length * 30)} horizontal />
          )}
        </section>
      )}

      {answer.proposedActions && answer.proposedActions.length > 0 && (
        <section className="mt-4" aria-label="Proposed actions">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Proposed actions · {answer.proposedActions.length}</p>
          <ul className="mt-2 space-y-2">
            {answer.proposedActions.map((a) => (
              <li key={a.id} className="surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-medium text-fg">{a.title}</p>
                      <Badge tone={RISK_TONE[a.risk]}>{humanize(a.risk)} risk</Badge>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{a.rationale}</p>
                  </div>
                  <div className="shrink-0">
                    <DecisionButtons actionId={a.id} status={a.status} canDecide={canDecide} title={a.title} size="xs" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {answer.sources.length > 0 && (
        <p className="mt-3 text-xs text-fg-subtle">
          <span className="text-fg-muted">Sources</span> · {answer.sources.join(", ")}
        </p>
      )}

      {answer.followUps.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Follow-up questions">
          {answer.followUps.slice(0, 3).map((q) => (
            <li key={q}>
              <button type="button" onClick={() => onFollowUp(q)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Sparkles className="h-3 w-3 text-accent" aria-hidden /> {q}
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
