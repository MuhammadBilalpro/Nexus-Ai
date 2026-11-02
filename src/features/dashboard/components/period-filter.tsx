"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { PERIODS, PERIOD_LABELS, parsePeriod } from "../period";

export function PeriodFilter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = parsePeriod(searchParams.get("period"));
  return (
    <div role="tablist" aria-label="Period" className="glass inline-flex rounded-md p-1">
      {PERIODS.map((p) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("period", p);
        const active = p === current;
        return (
          <Link
            key={p}
            role="tab"
            aria-selected={active}
            href={`${pathname}?${params.toString()}`}
            scroll={false}
            className={cn("rounded-sm px-3 py-1.5 text-xs font-medium transition-colors", active ? "bg-glass-strong text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]" : "text-fg-muted hover:text-fg")}
          >
            {PERIOD_LABELS[p]}
          </Link>
        );
      })}
    </div>
  );
}
