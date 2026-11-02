import * as React from "react";
import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  padded?: boolean;
  as?: "div" | "section" | "article";
}

/** The base surface. Everything on the dashboard sits on one of these. */
export function GlassCard({ className, strong = false, padded = true, as: Tag = "div", ...props }: GlassCardProps) {
  return <Tag className={cn(strong ? "glass-strong" : "glass", "rounded-lg", padded && "p-5", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-fg-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
