import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article" | "aside";
  padded?: boolean;
  interactive?: boolean;
}

/** The base surface: white on off-white, one fine border, no shadow unless it floats. */
export function Card({ className, as: Tag = "div", padded = true, interactive = false, ...props }: CardProps) {
  return <Tag className={cn("surface", padded && "p-5", interactive && "transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-sm", className)} {...props} />;
}

export function CardHeader({ title, description, action, className, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string; eyebrow?: React.ReactNode }) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">{eyebrow}</p>}
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} role="separator" />;
}
