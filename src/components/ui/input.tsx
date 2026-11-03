import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-md border border-line bg-surface text-sm text-fg placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ className, invalid, type = "text", ...props }: InputProps) {
  return <input type={type} aria-invalid={invalid || undefined} className={cn(base, "h-9 px-3", invalid && "border-danger focus:border-danger focus:ring-danger/25", className)} {...props} />;
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return <textarea aria-invalid={invalid || undefined} className={cn(base, "min-h-[88px] resize-y px-3 py-2 leading-relaxed", invalid && "border-danger", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, "h-9 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239b9b95%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_10px_center] bg-no-repeat pl-3 pr-8", className)} {...props}>
      {children}
    </select>
  );
}
