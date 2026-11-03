"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { ProjectCategory } from "@/generated/prisma/enums";
import { humanize } from "@/lib/format";
import { createProjectAction, type ActionResult } from "../actions";
import type { UserOption } from "../queries";

export function NewProjectButton({ managers }: { managers: UserOption[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const id = useId();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createProjectAction, null);
  const errors = state && "fieldErrors" in state ? state.fieldErrors ?? {} : {};

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      ref.current?.close();
      formRef.current?.reset();
      if (state.slug) router.push(`/projects/${state.slug}`);
    }
  }, [state, router]);

  return (
    <>
      <Button size="sm" onClick={() => ref.current?.showModal()}>
        <Plus className="h-3.5 w-3.5" aria-hidden /> New project
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(560px,calc(100vw-32px))] rounded-lg border border-line bg-surface p-0 text-fg shadow-md backdrop:bg-fg/30 backdrop:backdrop-blur-[2px] open:animate-fade-up"
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close();
        }}
      >
        <form ref={formRef} action={action} noValidate className="p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id={`${id}-title`} className="text-[17px] font-semibold tracking-tight">New project</h2>
              <p className="mt-0.5 text-[13px] text-fg-muted">Starts in Planning. You can add tasks, milestones and team afterwards.</p>
            </div>
            <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="rounded-sm p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {state && "error" in state && !state.fieldErrors && (
            <p role="alert" className="mb-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor={`${id}-name`}>Name</Label>
              <Input id={`${id}-name`} name="name" required maxLength={120} className="mt-1.5" invalid={Boolean(errors.name)} autoFocus />
              <FieldError>{errors.name}</FieldError>
            </div>
            <div>
              <Label htmlFor={`${id}-cat`}>Category</Label>
              <Select id={`${id}-cat`} name="category" className="mt-1.5" defaultValue={ProjectCategory.WEB_DEVELOPMENT}>
                {Object.values(ProjectCategory).map((c) => (
                  <option key={c} value={c}>{humanize(c)}</option>
                ))}
              </Select>
              <FieldError>{errors.category}</FieldError>
            </div>
            <div>
              <Label htmlFor={`${id}-budget`}>Budget (USD)</Label>
              <Input id={`${id}-budget`} name="budget" inputMode="decimal" placeholder="50000" required className="mt-1.5 tabular" invalid={Boolean(errors.budget)} />
              <FieldError>{errors.budget}</FieldError>
            </div>
            <div>
              <Label htmlFor={`${id}-start`}>Start date</Label>
              <Input id={`${id}-start`} name="startDate" type="date" className="mt-1.5" invalid={Boolean(errors.startDate)} />
              <FieldError>{errors.startDate}</FieldError>
            </div>
            <div>
              <Label htmlFor={`${id}-deadline`}>Deadline</Label>
              <Input id={`${id}-deadline`} name="deadline" type="date" className="mt-1.5" invalid={Boolean(errors.deadline)} />
              <FieldError>{errors.deadline}</FieldError>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`${id}-mgr`}>Manager</Label>
              <Select id={`${id}-mgr`} name="managerId" className="mt-1.5" defaultValue="">
                <option value="">Unassigned</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.title ? ` — ${m.title}` : ""}</option>
                ))}
              </Select>
              <FieldError>{errors.managerId}</FieldError>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor={`${id}-desc`}>Description</Label>
              <Textarea id={`${id}-desc`} name="description" maxLength={2000} className="mt-1.5" placeholder="Scope, goals, anything the team should know." invalid={Boolean(errors.description)} />
              <FieldError>{errors.description}</FieldError>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => ref.current?.close()}>Cancel</Button>
            <Button type="submit" size="sm" loading={pending}>Create project</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
