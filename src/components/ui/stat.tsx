import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Delta({ value, invert = false, suffix = "%" }: { value: number | null; invert?: boolean; suffix?: string }) {
  if (value === null) return <span className="text-xs text-fg-subtle">no baseline</span>;
  const good = invert ? value <= 0 : value >= 0;
  const Icon = value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular", value === 0 ? "text-fg-subtle" : good ? "text-success" : "text-danger")}>
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

export function Stat({ label, value, hint, delta, invert, className, tone }: { label: string; value: string; hint?: React.ReactNode; delta?: number | null; invert?: boolean; className?: string; tone?: "default" | "danger" | "warning" | "success" }) {
  return (
    <div className={cn("surface p-5", className)}>
      <p className="text-[13px] text-fg-muted">{label}</p>
      <p className={cn("mt-2 text-[26px] font-semibold leading-none tracking-tight tabular", tone === "danger" && "text-danger", tone === "warning" && "text-warning", tone === "success" && "text-success")}>{value}</p>
      <div className="mt-2.5 flex items-center gap-2 text-xs text-fg-subtle">
        {delta !== undefined && <Delta value={delta} invert={invert} />}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

export function Progress({ value, className, tone = "default", label }: { value: number; className?: string; tone?: "default" | "accent" | "warning" | "danger" | "success"; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const bar = { default: "bg-fg", accent: "bg-accent", warning: "bg-warning", danger: "bg-danger", success: "bg-success" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out-quart", bar)} style={{ width: `${v}%` }} />
    </div>
  );
}
