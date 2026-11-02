import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "border-line-strong bg-glass text-fg-muted",
      blue: "border-blue/30 bg-blue/10 text-blue",
      violet: "border-violet/30 bg-violet/10 text-violet",
      cyan: "border-cyan/30 bg-cyan/10 text-cyan",
      emerald: "border-emerald/30 bg-emerald/10 text-emerald",
      amber: "border-amber/30 bg-amber/10 text-amber",
      rose: "border-rose/30 bg-rose/10 text-rose",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}

export type BadgeTone = NonNullable<BadgeProps["tone"]>;
