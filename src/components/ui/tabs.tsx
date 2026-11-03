"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface TabItem {
  label: string;
  /** Either a path (href) or a query value for `param`. */
  value: string;
  count?: number;
}

/**
 * Link-based segmented control. Works for path tabs (href per item) and
 * query-param tabs (`param` + value) so every tab is a real navigation.
 */
export function Tabs({ items, param, className, size = "md", defaultValue }: { items: TabItem[]; param?: string; className?: string; size?: "sm" | "md"; defaultValue?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = param ? (searchParams.get(param) ?? defaultValue ?? items[0]?.value) : pathname;

  return (
    <div role="tablist" className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto whitespace-nowrap rounded-md border border-line bg-surface-2 p-0.5 scrollbar-thin", className)}>
      {items.map((item) => {
        let href = item.value;
        if (param) {
          const p = new URLSearchParams(searchParams.toString());
          p.set(param, item.value);
          href = `${pathname}?${p.toString()}`;
        }
        const active = param ? current === item.value : pathname === item.value || (item.value !== "/" && pathname.startsWith(item.value));
        return (
          <Link
            key={item.value}
            role="tab"
            aria-selected={active}
            href={href}
            scroll={false}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-[6px] font-medium transition-[background-color,color,box-shadow] duration-150",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              active ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg",
            )}
          >
            {item.label}
            {item.count !== undefined && <span className={cn("tabular text-[11px]", active ? "text-fg-subtle" : "text-fg-subtle")}>{item.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
