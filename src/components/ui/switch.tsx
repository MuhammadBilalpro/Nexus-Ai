"use client";

import { cn } from "@/lib/utils";

export function Switch({ checked, onChange, disabled, label, className }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", checked ? "border-accent bg-accent" : "border-line-strong bg-surface-3", className)}
    >
      <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200", checked ? "translate-x-[18px]" : "translate-x-[3px]")} />
    </button>
  );
}
