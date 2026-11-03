"use client";

import { useState, useTransition } from "react";
import { Workflow as WorkflowIcon } from "lucide-react";
import { StepKind } from "@/generated/prisma/enums";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError } from "@/components/ui/label";
import type { StepView } from "../queries";
import type { ValidationItem } from "../validation";
import { addStepAction } from "../actions";
import { BlockPicker } from "./block-picker";
import { StepNode } from "./step-node";

function Connector() {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <span className="h-5 w-px bg-line-strong" />
      <svg width="10" height="6" viewBox="0 0 10 6" className="-mt-px text-line-strong"><path d="M0 0 L5 6 L10 0" fill="currentColor" /></svg>
    </div>
  );
}

/** Which kind the picker should surface first at a given insertion index. */
function suggestKind(steps: StepView[], insertIndex: number): StepKind {
  if (steps.length === 0 || insertIndex === 0) return StepKind.TRIGGER;
  if (insertIndex >= steps.length) return StepKind.ACTION;
  const prev = steps[insertIndex - 1];
  return prev.kind === StepKind.TRIGGER ? StepKind.CONDITION : StepKind.AGENT;
}

export function FlowCanvas({ workflowId, steps, canManage, validation }: { workflowId: string; steps: StepView[]; canManage: boolean; validation: ValidationItem[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = (afterOrder: number, type: string) => {
    setError(null);
    start(async () => {
      const r = await addStepAction({ workflowId, afterOrder, type });
      if ("error" in r) setError(r.error);
    });
  };

  const problemsFor = (order: number) => validation.filter((v) => v.level === "error" && v.stepOrder === order).map((v) => v.message);

  return (
    <section aria-label="Workflow canvas" className="relative rounded-lg border border-line bg-surface-2/40 p-4 sm:p-6">
      {steps.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="Start with a trigger"
          description={canManage ? "Every workflow begins with the event that starts it. Add a trigger, then an AI agent or an action." : "This workflow has no steps yet."}
          action={canManage ? <BlockPicker label="Add first step" suggestedKind={StepKind.TRIGGER} disabled={pending} onPick={(type) => add(-1, type)} /> : undefined}
        />
      ) : (
        <ol className="mx-auto flex max-w-xl flex-col items-stretch" aria-label="Steps in order">
          {canManage && (
            <li className="mb-1 flex justify-center" aria-label="Insert before first step">
              <BlockPicker label="Add step at the start" suggestedKind={StepKind.TRIGGER} disabled={pending} onPick={(type) => add(-1, type)} />
            </li>
          )}
          {steps.map((s, i) => (
            <li key={s.id} className="flex flex-col items-stretch">
              {i > 0 && <Connector />}
              <StepNode workflowId={workflowId} step={s} index={i} total={steps.length} canManage={canManage} problems={problemsFor(s.order)} />
              {canManage && (
                <div className="mt-1 flex justify-center">
                  <div className="flex flex-col items-center">
                    <span className="h-3 w-px bg-line-strong" aria-hidden />
                    <BlockPicker label={`Add step after step ${i + 1}`} suggestedKind={suggestKind(steps, i + 1)} disabled={pending} onPick={(type) => add(s.order, type)} />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {error && <div className="mx-auto mt-3 max-w-xl"><FieldError>{error}</FieldError></div>}
    </section>
  );
}
