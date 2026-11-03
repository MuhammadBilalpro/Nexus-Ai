import { StatSkeleton, CardSkeleton } from "@/components/ui/skeleton";

export default function SectionLoading() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-64 skeleton" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <CardSkeleton className="xl:col-span-2" rows={6} />
        <CardSkeleton rows={6} />
      </div>
    </div>
  );
}
