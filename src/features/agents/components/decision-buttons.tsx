"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { decideActionAction } from "../actions";
import type { ActionStatus } from "@/generated/prisma/enums";

/**
 * Approve / Reject pair wired to the real Server Action. After a decision the
 * row's status is shown honestly: approval queues the action for the Phase 4
 * automation engine — nothing external runs here.
 */
export function DecisionButtons({ actionId, status, canDecide, title, size = "sm" }: { actionId: string; status: ActionStatus; canDecide: boolean; title: string; size?: "xs" | "sm" }) {
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<ActionStatus>(status);
  const effective = local === "PENDING" ? status : local;

  if (effective !== "PENDING") return <StatusLabel status={effective} />;
  if (!canDecide) return <Badge tone="outline">Awaiting decision</Badge>;

  const decide = (decision: "APPROVED" | "REJECTED") => {
    setChoice(decision);
    setError(null);
    start(async () => {
      const res = await decideActionAction(actionId, decision);
      if ("error" in res) setError(res.error);
      else setLocal(decision);
      setChoice(null);
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5" role="group" aria-label={`Decide on: ${title}`}>
        <Button type="button" size={size} variant="secondary" onClick={() => decide("REJECTED")} loading={pending && choice === "REJECTED"} disabled={pending} aria-label={`Reject: ${title}`}>
          {!(pending && choice === "REJECTED") && <X className="h-3.5 w-3.5" aria-hidden />} Reject
        </Button>
        <Button type="button" size={size} variant="primary" onClick={() => decide("APPROVED")} loading={pending && choice === "APPROVED"} disabled={pending} aria-label={`Approve: ${title}`}>
          {!(pending && choice === "APPROVED") && <Check className="h-3.5 w-3.5" aria-hidden />} Approve
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function StatusLabel({ status }: { status: ActionStatus }) {
  if (status === "APPROVED") return <Badge tone="success" dot>Approved — queued for execution (Phase 4 automation engine)</Badge>;
  if (status === "REJECTED") return <Badge tone="neutral" dot>Rejected</Badge>;
  return <Badge tone="outline">Pending</Badge>;
}
