import { cn } from "@/lib/utils";

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line bg-surface-2 px-1 font-mono text-[10px] text-fg-subtle", className)}>{children}</kbd>;
}
