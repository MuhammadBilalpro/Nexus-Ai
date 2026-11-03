import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  );
}
export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("text-left text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle", className)} {...props} />;
}
export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("border-b border-line px-4 py-2.5 font-medium first:pl-5 last:pr-5", className)} {...props} />;
}
export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-line", className)} {...props} />;
}
export function TR({ className, interactive = false, ...props }: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return <tr className={cn(interactive && "transition-colors duration-100 hover:bg-surface-2/60", className)} {...props} />;
}
export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle first:pl-5 last:pr-5", className)} {...props} />;
}
