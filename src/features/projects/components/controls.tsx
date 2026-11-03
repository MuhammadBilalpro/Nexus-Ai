"use client";

import { useId, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProjectStatus, TaskStatus } from "@/generated/prisma/enums";
import { humanize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updateProjectStatusAction, updateTaskStatusAction, addProjectMemberAction, completeMilestoneAction, type ActionResult } from "../actions";
import type { UserOption } from "../queries";

/** Inline error for a submit-on-change control. */
function InlineError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p role="alert" className="mt-1 text-[11px] text-danger">{msg}</p>;
}

function useSubmit(run: (fd: FormData) => Promise<ActionResult>) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const r = await run(fd);
      if ("error" in r) setError(r.error);
    });
  return { pending, error, submit };
}

export function ProjectStatusSelect({ projectId, status, name, className }: { projectId: string; status: ProjectStatus; name: string; className?: string }) {
  const { pending, error, submit } = useSubmit(updateProjectStatusAction);
  return (
    <div className={className}>
      <Select
        aria-label={`Move ${name} to another column`}
        value={status}
        disabled={pending}
        className="h-7 rounded-xs text-xs"
        onChange={(e) => {
          const fd = new FormData();
          fd.set("projectId", projectId);
          fd.set("status", e.target.value);
          submit(fd);
        }}
      >
        {Object.values(ProjectStatus).filter((s) => s !== ProjectStatus.CANCELLED || status === ProjectStatus.CANCELLED).map((s) => (
          <option key={s} value={s}>{s === status ? `Status: ${humanize(s)}` : `Move to ${humanize(s)}`}</option>
        ))}
      </Select>
      <InlineError msg={error} />
    </div>
  );
}

export function TaskStatusSelect({ taskId, status, title }: { taskId: string; status: TaskStatus; title: string }) {
  const { pending, error, submit } = useSubmit(updateTaskStatusAction);
  return (
    <div>
      <Select
        aria-label={`Status of ${title}`}
        value={status}
        disabled={pending}
        className={cn("h-7 w-32 rounded-xs text-xs", status === TaskStatus.DONE && "text-fg-muted")}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("taskId", taskId);
          fd.set("status", e.target.value);
          submit(fd);
        }}
      >
        {Object.values(TaskStatus).map((s) => (
          <option key={s} value={s}>{humanize(s)}</option>
        ))}
      </Select>
      <InlineError msg={error} />
    </div>
  );
}

export function AddMemberForm({ projectId, candidates }: { projectId: string; candidates: UserOption[] }) {
  const id = useId();
  const { pending, error, submit } = useSubmit(addProjectMemberAction);
  const [userId, setUserId] = useState("");
  if (candidates.length === 0) return <p className="text-xs text-fg-subtle">Everyone is already on this project.</p>;
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!userId) return;
        const fd = new FormData(e.currentTarget);
        fd.set("projectId", projectId);
        submit(fd);
        setUserId("");
      }}
    >
      <div className="flex-1">
        <label htmlFor={`${id}-user`} className="text-xs font-medium text-fg-muted">Add member</label>
        <Select id={`${id}-user`} name="userId" value={userId} onChange={(e) => setUserId(e.target.value)} className="mt-1.5" required>
          <option value="">Choose a person…</option>
          {candidates.map((u) => (
            <option key={u.id} value={u.id}>{u.name}{u.title ? ` — ${u.title}` : ""}</option>
          ))}
        </Select>
        <InlineError msg={error} />
      </div>
      <Button type="submit" size="md" variant="secondary" loading={pending} disabled={!userId}>Add</Button>
    </form>
  );
}

export function CompleteMilestoneButton({ milestoneId, title }: { milestoneId: string; title: string }) {
  const { pending, error, submit } = useSubmit(completeMilestoneAction);
  return (
    <div className="text-right">
      <Button
        type="button"
        size="xs"
        variant="secondary"
        loading={pending}
        aria-label={`Mark milestone ${title} complete`}
        onClick={() => {
          const fd = new FormData();
          fd.set("milestoneId", milestoneId);
          submit(fd);
        }}
      >
        <Check className="h-3 w-3" aria-hidden /> Mark complete
      </Button>
      <InlineError msg={error} />
    </div>
  );
}
