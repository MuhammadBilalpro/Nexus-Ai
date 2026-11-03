import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon = Inbox, title, description, action, className, compact = false }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong px-6 text-center", compact ? "py-7" : "py-12", className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface-2">
        <Icon className="h-4.5 w-4.5 text-fg-subtle" aria-hidden />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fg-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
