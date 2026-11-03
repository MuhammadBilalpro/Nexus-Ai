import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const SIZES = { xs: "h-5 w-5 text-[9px]", sm: "h-7 w-7 text-[10px]", md: "h-8 w-8 text-[11px]", lg: "h-11 w-11 text-sm" } as const;

export function Avatar({ name, size = "md", className }: { name: string | null | undefined; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-semibold text-fg-muted", SIZES[size], className)} aria-hidden>
      {initials(name)}
    </span>
  );
}
