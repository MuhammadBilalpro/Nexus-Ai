import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary: "bg-fg text-bg hover:bg-fg/90 shadow-sm",
        accent: "bg-accent text-accent-fg hover:bg-accent-strong shadow-sm",
        secondary: "bg-surface text-fg border border-line hover:bg-surface-2 hover:border-line-strong",
        ghost: "text-fg-muted hover:text-fg hover:bg-surface-2",
        danger: "bg-danger text-white hover:brightness-95",
        link: "text-accent hover:underline underline-offset-4 h-auto px-0",
      },
      size: {
        xs: "h-7 rounded-xs px-2.5 text-xs",
        sm: "h-8 rounded-sm px-3 text-[13px]",
        md: "h-9 rounded-md px-3.5 text-sm",
        lg: "h-10 rounded-md px-4 text-sm",
        icon: "h-8 w-8 rounded-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({ className, variant, size, loading = false, disabled, children, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export { buttonVariants };
