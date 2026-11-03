import { StatSkeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function AutomationLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-48 skeleton" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)}
      </div>
      <CardSkeleton rows={6} />
    </div>
  );
}
