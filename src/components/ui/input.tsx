import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-10 w-full rounded-md border border-line bg-bg-900/60 px-3 text-sm text-fg placeholder:text-fg-subtle shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[border-color,box-shadow] duration-200",
        "hover:border-line-strong focus:border-blue/60 focus:outline-none focus:ring-2 focus:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-rose/60 focus:border-rose/70 focus:ring-rose/30",
        className,
      )}
      {...props}
    />
  );
}
