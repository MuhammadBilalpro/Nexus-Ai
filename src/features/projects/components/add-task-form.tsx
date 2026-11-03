"use client";

import { useActionState, useId, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { TaskPriority } from "@/generated/prisma/enums";
import { humanize } from "@/lib/format";
import { createTaskAction, type ActionResult } from "../actions";
import type { UserOption } from "../queries";

export function AddTaskForm({ projectId, assignees }: { projectId: string; assignees: UserOption[] }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, fd) => {
    const r = await createTaskAction(prev, fd);
    // The panel unmounts on success, which also clears the form.
    if ("ok" in r) setOpen(false);
    return r;
  }, null);
  const errors = state && "fieldErrors" in state ? state.fieldErrors ?? {} : {};

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)} aria-expanded={false} aria-controls={`${id}-panel`}>
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add task
      </Button>
    );
  }

  return (
    <form id={`${id}-panel`} action={action} noValidate className="rounded-md border border-line bg-surface-2/50 p-4 animate-fade-in">
      <input type="hidden" name="projectId" value={projectId} />
      {state && "error" in state && !state.fieldErrors && <p role="alert" className="mb-3 text-xs text-danger">{state.error}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1.5fr_1fr]">
        <div>
          <Label htmlFor={`${id}-title`}>Title</Label>
          <Input id={`${id}-title`} name="title" required maxLength={200} className="mt-1.5" invalid={Boolean(errors.title)} autoFocus />
          <FieldError>{errors.title}</FieldError>
        </div>
        <div>
          <Label htmlFor={`${id}-prio`}>Priority</Label>
          <Select id={`${id}-prio`} name="priority" className="mt-1.5" defaultValue={TaskPriority.MEDIUM}>
            {Object.values(TaskPriority).map((p) => (
              <option key={p} value={p}>{humanize(p)}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${id}-who`}>Assignee</Label>
          <Select id={`${id}-who`} name="assigneeId" className="mt-1.5" defaultValue="">
            <option value="">Unassigned</option>
            {assignees.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
          <FieldError>{errors.assigneeId}</FieldError>
        </div>
        <div>
          <Label htmlFor={`${id}-due`}>Due date</Label>
          <Input id={`${id}-due`} name="dueDate" type="date" className="mt-1.5" invalid={Boolean(errors.dueDate)} />
          <FieldError>{errors.dueDate}</FieldError>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" loading={pending}>Add task</Button>
      </div>
    </form>
  );
}
