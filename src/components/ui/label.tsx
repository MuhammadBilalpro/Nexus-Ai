import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium text-fg-muted", className)} {...props} />;
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-danger">
      {children}
    </p>
  );
}

export function Hint({ children, id, className }: { children: React.ReactNode; id?: string; className?: string }) {
  return (
    <p id={id} className={cn("mt-1.5 text-xs text-fg-subtle", className)}>
      {children}
    </p>
  );
}
