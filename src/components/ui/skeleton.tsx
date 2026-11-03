import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function StatSkeleton() {
  return (
    <div className="surface p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-7 w-28" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}

export function CardSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("surface p-5", className)}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-56" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
