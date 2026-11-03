"use client";

import { useActionState, useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label, FieldError, Hint } from "@/components/ui/label";
import { createWorkflowAction, type CreateWorkflowState } from "../actions";

/** "New workflow" button that expands into an inline form; submits to createWorkflowAction which redirects to the builder. */
export function NewWorkflowForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<CreateWorkflowState, FormData>(createWorkflowAction, {});
  const id = useId();

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} aria-expanded={false} aria-controls={`${id}-form`}>
        <Plus className="h-3.5 w-3.5" aria-hidden /> New workflow
      </Button>
    );
  }

  return (
    <form id={`${id}-form`} action={action} noValidate className="w-full rounded-lg border border-line bg-surface p-4 sm:w-[380px] animate-fade-in" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[14px] font-medium text-fg">New workflow</p>
        <Button type="button" variant="ghost" size="icon" className="-mr-2 -mt-1 h-7 w-7" onClick={() => setOpen(false)} aria-label="Cancel">
          <X className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
      <div className="mt-3 space-y-3">
        <div>
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input autoFocus id={`${id}-name`} name="name" required maxLength={80} placeholder="Invoice overdue → notify finance" className="mt-1.5" invalid={Boolean(state.fieldErrors?.name)} aria-describedby={state.fieldErrors?.name ? `${id}-name-err` : undefined} />
          <FieldError id={`${id}-name-err`}>{state.fieldErrors?.name}</FieldError>
        </div>
        <div>
          <Label htmlFor={`${id}-desc`}>Description <span className="font-normal text-fg-subtle">(optional)</span></Label>
          <Textarea id={`${id}-desc`} name="description" maxLength={300} rows={2} className="mt-1.5 min-h-[64px]" placeholder="What should happen, and when." invalid={Boolean(state.fieldErrors?.description)} />
          <FieldError>{state.fieldErrors?.description}</FieldError>
        </div>
        {state.error && <FieldError>{state.error}</FieldError>}
        <Hint className="mt-0">The workflow starts disabled. Add a trigger and an action in the builder, then enable it.</Hint>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" size="sm" loading={pending}>Create and open</Button>
        </div>
      </div>
    </form>
  );
}
