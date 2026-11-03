"use client";

import { useId, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label, FieldError, Hint } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { findBlock, integrationLabel, type ConfigField } from "../catalog";
import type { StepView } from "../queries";
import { removeStepAction, reorderStepAction, updateStepAction } from "../actions";
import { KindEyebrow, KindIcon } from "./step-visuals";

interface Props {
  workflowId: string;
  step: StepView;
  index: number;
  total: number;
  canManage: boolean;
  /** Validation errors referring to this step (by order). */
  problems: string[];
}

export function StepNode({ workflowId, step, index, total, canManage, problems }: Props) {
  const block = findBlock(step.type);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = useId();

  const run = (fn: () => Promise<{ ok: true } | { error: string }>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else after?.();
    });
  };

  const hasErrors = problems.length > 0;

  return (
    <article
      aria-labelledby={`${id}-title`}
      className={cn("surface relative w-full p-4 transition-[border-color] duration-150 animate-fade-up", hasErrors ? "border-danger/40" : step.connected ? "hover:border-line-strong" : "border-dashed border-warning/50")}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <div className="flex items-start gap-3">
        <KindIcon kind={step.kind} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <KindEyebrow kind={step.kind} />
            {!step.known && <Badge tone="danger">Unknown block</Badge>}
            {step.known && !step.connected && <Badge tone="warning">{integrationLabel(block)} not connected</Badge>}
            {block?.requiresHumanApproval && <Badge tone="outline">Pauses for human approval</Badge>}
          </div>
          <h3 id={`${id}-title`} className="mt-1 text-[14px] font-medium leading-snug text-fg">{step.label}</h3>
          <p className="mt-0.5 text-[13px] text-fg-muted">{block?.description ?? `Block type "${step.type}" is not in the catalog.`}</p>
          {step.configSummary && (
            <p className={cn("mt-2 inline-flex items-center rounded-xs border border-line bg-surface-2 px-2 py-0.5 text-xs tabular", step.configSummary === "Not configured" ? "text-fg-subtle" : "text-fg-muted")}>{step.configSummary}</p>
          )}
          {!step.connected && step.known && <p className="mt-2 text-xs text-warning">A live run will pause at this step until {integrationLabel(block)} is connected.</p>}
          {problems.map((p) => (
            <p key={p} role="alert" className="mt-2 text-xs text-danger">{p}</p>
          ))}
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-0.5" role="toolbar" aria-label={`Actions for step ${index + 1}`}>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Move step up" disabled={pending || index === 0} onClick={() => run(() => reorderStepAction({ workflowId, stepId: step.id, direction: "up" }))}>
              <ArrowUp className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Move step down" disabled={pending || index === total - 1} onClick={() => run(() => reorderStepAction({ workflowId, stepId: step.id, direction: "down" }))}>
              <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={editing ? "Close editor" : "Edit step"} aria-expanded={editing} aria-controls={`${id}-editor`} disabled={pending || !step.known} onClick={() => setEditing((e) => !e)}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 hover:text-danger" aria-label="Remove step" disabled={pending} onClick={() => run(() => removeStepAction({ workflowId, stepId: step.id }))}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {error && <FieldError>{error}</FieldError>}

      {editing && block && (
        <StepEditor
          id={`${id}-editor`}
          step={step}
          fields={block.configFields ?? []}
          pending={pending}
          onCancel={() => setEditing(false)}
          onSave={(label, config) => run(() => updateStepAction({ workflowId, stepId: step.id, label, config }), () => setEditing(false))}
        />
      )}
    </article>
  );
}

function StepEditor({ id, step, fields, pending, onCancel, onSave }: { id: string; step: StepView; fields: ConfigField[]; pending: boolean; onCancel: () => void; onSave: (label: string, config: Record<string, string | number | null>) => void }) {
  const [label, setLabel] = useState(step.label);
  const [config, setConfig] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, step.config[f.key] === null || step.config[f.key] === undefined ? "" : String(step.config[f.key])])));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const out: Record<string, string | number | null> = {};
    for (const f of fields) {
      const v = config[f.key] ?? "";
      if (v === "") out[f.key] = null;
      else out[f.key] = f.input === "number" ? Number(v) : v;
    }
    onSave(label.trim(), out);
  };

  return (
    <form id={id} onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} className="mt-4 space-y-3 rounded-md border border-line bg-surface-2/60 p-3 animate-fade-in" aria-label="Edit step">
      <div>
        <Label htmlFor={`${id}-label`}>Label</Label>
        <Input id={`${id}-label`} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} required className="mt-1.5 h-8 text-[13px]" />
      </div>
      {fields.length === 0 && <Hint className="mt-0">This block has no settings.</Hint>}
      {fields.map((f) => (
        <div key={f.key}>
          <Label htmlFor={`${id}-${f.key}`}>{f.label}{f.unit ? <span className="font-normal text-fg-subtle"> · {f.unit}</span> : null}</Label>
          {f.input === "select" ? (
            <Select id={`${id}-${f.key}`} value={config[f.key] ?? ""} onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))} className="mt-1.5 h-8 text-[13px]">
              <option value="">Choose…</option>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          ) : (
            <Input id={`${id}-${f.key}`} type={f.input === "number" ? "number" : "text"} inputMode={f.input === "number" ? "numeric" : undefined} min={f.min} max={f.max} step={f.input === "number" ? "any" : undefined} placeholder={f.placeholder} value={config[f.key] ?? ""} onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))} className="mt-1.5 h-8 text-[13px]" />
          )}
        </div>
      ))}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="xs" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="xs" loading={pending}>Save</Button>
      </div>
    </form>
  );
}
