import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wordmark: a quiet square with the AI dot, then the name. */
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-sm", className)} aria-label="NEXUS AI home">
      <span className="relative flex h-6 w-6 items-center justify-center rounded-[7px] bg-fg">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
      </span>
      <span className="text-[14px] font-semibold tracking-tight text-fg">NEXUS</span>
    </Link>
  );
}
