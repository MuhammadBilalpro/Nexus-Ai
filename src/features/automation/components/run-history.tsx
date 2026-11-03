import { History } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { RunView } from "../queries";
import { RunStatusBadge } from "./step-visuals";

function duration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function RunHistory({ runs }: { runs: RunView[] }) {
  return (
    <Card as="section" aria-labelledby="runs-heading" padded={false}>
      <CardHeader className="mb-0 px-5 pt-5" title={<span id="runs-heading">Execution history</span>} description={runs.length ? `Last ${runs.length} run${runs.length === 1 ? "" : "s"}` : "Dry runs and live runs appear here"} />
      {runs.length === 0 ? (
        <div className="p-5"><EmptyState compact icon={History} title="No runs yet" description="Use Dry run to validate the chain and record the first entry." /></div>
      ) : (
        <ol className="mt-3 divide-y divide-line">
          {runs.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <RunStatusBadge status={r.status} />
                  <time dateTime={r.startedAtIso} className="text-xs text-fg-subtle">{r.startedAtLabel}</time>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-fg">{r.summary}</p>
              </div>
              <span className="shrink-0 text-xs tabular text-fg-subtle">{duration(r.durationMs)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
