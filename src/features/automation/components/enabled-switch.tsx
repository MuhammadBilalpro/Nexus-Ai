"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toggleWorkflowAction } from "../actions";

/**
 * Real enable/disable control. Users without `automation:manage` get a
 * read-only badge instead of a disabled switch so the state stays legible.
 */
export function EnabledSwitch({ workflowId, enabled, canManage, name, showLabel = false }: { workflowId: string; enabled: boolean; canManage: boolean; name: string; showLabel?: boolean }) {
  const [optimistic, setOptimistic] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const current = pending ? optimistic : enabled;

  if (!canManage) {
    return <Badge tone={enabled ? "success" : "neutral"} dot>{enabled ? "Enabled" : "Disabled"}</Badge>;
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={current}
        disabled={pending}
        label={`${current ? "Disable" : "Enable"} ${name}`}
        onChange={(next) => {
          setOptimistic(next);
          setError(null);
          start(async () => {
            const r = await toggleWorkflowAction({ workflowId, enabled: next });
            if ("error" in r) {
              setOptimistic(!next);
              setError(r.error);
            }
          });
        }}
      />
      {showLabel && <span className="text-[13px] text-fg-muted">{current ? "Enabled" : "Disabled"}</span>}
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </div>
  );
}
