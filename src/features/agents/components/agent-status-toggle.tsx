"use client";

import { useState, useTransition } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleAgentStatusAction } from "../actions";
import type { AgentStatus } from "@/generated/prisma/enums";

export function AgentStatusToggle({ agentId, status, name }: { agentId: string; status: AgentStatus; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const paused = status === "PAUSED";
  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={pending}
        aria-label={paused ? `Resume ${name}` : `Pause ${name}`}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await toggleAgentStatusAction(agentId);
            if ("error" in res) setError(res.error);
          });
        }}
      >
        {!pending && (paused ? <Play className="h-3.5 w-3.5" aria-hidden /> : <Pause className="h-3.5 w-3.5" aria-hidden />)}
        {paused ? "Resume" : "Pause"}
      </Button>
      {error && <p role="alert" className="max-w-xs text-right text-xs text-danger">{error}</p>}
    </div>
  );
}
