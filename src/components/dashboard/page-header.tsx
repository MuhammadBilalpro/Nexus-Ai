import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions, className, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string; eyebrow?: React.ReactNode }) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-fg-subtle">{eyebrow}</p>}
        <h1 className="text-[22px] font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-fg-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
