"use client";

import { useId, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, Play, Trash2, UserCheck } from "lucide-react";
import { Card, CardHeader, Divider } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label, FieldError, Hint } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkflowDetail } from "../queries";
import { deleteWorkflowAction, runWorkflowTestAction, updateWorkflowAction } from "../actions";
import { EnabledSwitch } from "./enabled-switch";

export function WorkflowSettings({ workflow, canManage }: { workflow: WorkflowDetail; canManage: boolean }) {
  const id = useId();
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description ?? "");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSave] = useTransition();

  const [runMsg, setRunMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [running, startRun] = useTransition();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const dirty = name.trim() !== workflow.name || description.trim() !== (workflow.description ?? "");
  const v = workflow.validation;
  const errors = v.items.filter((i) => i.level === "error");
  const warnings = v.items.filter((i) => i.level === "warning");

  return (
    <div className="space-y-4">
      <Card as="section" aria-labelledby={`${id}-settings`}>
        <CardHeader title={<span id={`${id}-settings`}>Workflow settings</span>} description={`Updated ${workflow.updatedAtLabel}`} action={<EnabledSwitch workflowId={workflow.id} enabled={workflow.enabled} canManage={canManage} name={workflow.name} showLabel />} />
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSaveError(null);
            setSaved(false);
            startSave(async () => {
              const r = await updateWorkflowAction({ workflowId: workflow.id, name: name.trim(), description: description.trim() });
              if ("error" in r) setSaveError(r.error);
              else setSaved(true);
            });
          }}
        >
          <div>
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required readOnly={!canManage} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor={`${id}-desc`}>Description</Label>
            <Textarea id={`${id}-desc`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={3} readOnly={!canManage} className="mt-1.5 min-h-[72px]" />
          </div>
          {saveError && <FieldError>{saveError}</FieldError>}
          {canManage && (
            <div className="flex items-center justify-between gap-2">
              {saved && !dirty ? <p role="status" className="text-xs text-success">Saved.</p> : <span />}
              <Button type="submit" size="sm" variant="secondary" disabled={!dirty} loading={saving}>Save changes</Button>
            </div>
          )}
        </form>

        <Divider className="my-4" />

        <div className="flex items-start gap-2.5">
          <UserCheck className={cn("mt-0.5 h-4 w-4 shrink-0", v.requiresHumanApproval ? "text-fg" : "text-fg-subtle")} aria-hidden />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-medium text-fg">Human approval</p>
              <Badge tone={v.requiresHumanApproval ? "outline" : "neutral"}>{v.requiresHumanApproval ? "Required" : "Not required"}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-fg-muted">{v.requiresHumanApproval ? "This workflow pauses for a person before any outbound action is taken." : "Add a “Request human approval” action to put a person in the loop."}</p>
          </div>
        </div>

        <Divider className="my-4" />

        <div>
          <p className="text-[13px] font-medium text-fg">Validation</p>
          <ul className="mt-2 space-y-1.5" aria-label="Validation results">
            {errors.length === 0 && (
              <li className="flex items-start gap-2 text-[13px] text-fg-muted"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden /> Chain is valid: starts with a trigger and ends with an action.</li>
            )}
            {errors.map((i) => (
              <li key={i.message} className="flex items-start gap-2 text-[13px] text-fg"><CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden /> {i.message}</li>
            ))}
            {warnings.map((i) => (
              <li key={i.message} className="flex items-start gap-2 text-[13px] text-fg-muted"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden /> {i.message}</li>
            ))}
          </ul>
        </div>

        {canManage && (
          <>
            <Divider className="my-4" />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={running}
                onClick={() => {
                  setRunMsg(null);
                  startRun(async () => {
                    const r = await runWorkflowTestAction({ workflowId: workflow.id });
                    setRunMsg("error" in r ? { tone: "danger", text: r.error } : { tone: "success", text: `Dry run recorded: ${workflow.steps.length} steps validated.` });
                  });
                }}
              >
                <Play className="h-3.5 w-3.5" aria-hidden /> Dry run
              </Button>
              {runMsg && <p role="status" className={cn("text-xs", runMsg.tone === "success" ? "text-success" : "text-danger")}>{runMsg.text}</p>}
            </div>
            <Hint>A dry run validates the chain and records a run in the history. No notifications, tasks or emails are produced. Live execution ships with the Phase 4 engine.</Hint>
          </>
        )}
      </Card>

      {canManage && (
        <Card as="section" aria-labelledby={`${id}-danger`} className="border-danger/20">
          <CardHeader title={<span id={`${id}-danger`}>Delete workflow</span>} description="Removes the workflow, its steps and its run history. This cannot be undone." />
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="danger"
                loading={deleting}
                onClick={() => {
                  setDeleteError(null);
                  startDelete(async () => {
                    const r = await deleteWorkflowAction({ workflowId: workflow.id });
                    if (r && "error" in r) setDeleteError(r.error);
                  });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Yes, delete “{workflow.name}”
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" className="text-danger hover:border-danger/40" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete workflow
            </Button>
          )}
          {deleteError && <FieldError>{deleteError}</FieldError>}
        </Card>
      )}
    </div>
  );
}
