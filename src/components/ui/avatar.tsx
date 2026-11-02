import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const SIZES = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm" } as const;

export function Avatar({ name, size = "md", className }: { name: string | null | undefined; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-line-strong bg-[linear-gradient(135deg,rgba(91,140,255,0.35),rgba(139,123,255,0.35))] font-semibold text-fg",
        SIZES[size],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
