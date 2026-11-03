"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function ErrorState({ title = "Something went wrong", description = "The data could not be loaded. Try again, and contact an administrator if the problem persists.", onRetry, className }: { title?: string; description?: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center rounded-lg border border-danger/30 bg-danger-soft/40 px-6 py-12 text-center", className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-danger/30 bg-danger-soft">
        <AlertTriangle className="h-4.5 w-4.5 text-danger" aria-hidden />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-fg-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Retry
        </Button>
      )}
    </div>
  );
}
