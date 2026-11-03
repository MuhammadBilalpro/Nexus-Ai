import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { StatSkeleton, CardSkeleton } from "@/components/ui/skeleton";
import type { BadgeTone } from "@/components/ui/badge";
import type { ProjectHealth, ProjectStatus, InvoiceStatus } from "@/generated/prisma/enums";

export const HEALTH_TONE: Record<ProjectHealth, BadgeTone> = { ON_TRACK: "success", AT_RISK: "warning", DELAYED: "danger" };
export const STATUS_TONE: Record<ProjectStatus, BadgeTone> = { PLANNING: "neutral", ACTIVE: "accent", ON_HOLD: "warning", COMPLETED: "success", CANCELLED: "outline" };
export const INVOICE_TONE: Record<InvoiceStatus, BadgeTone> = { DRAFT: "neutral", SENT: "outline", PAID: "success", OVERDUE: "danger", CANCELLED: "outline" };

export function FinancialsLocked() {
  return <EmptyState icon={Lock} title="Financial insights are limited to finance and executive roles" description="Ask an administrator for the Finance Manager or CEO role if you need access to revenue and margin data." />;
}

export function ViewSkeleton({ stats = 4, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: stats }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
      <CardSkeleton rows={rows} />
      <CardSkeleton rows={rows} />
    </div>
  );
}

export function daysLabel(days: number | null): string {
  if (days === null) return "No deadline";
  if (days === 0) return "Due today";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `${days}d left`;
}
