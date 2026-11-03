import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/stat";
import { cn } from "@/lib/utils";
import type { HealthScore } from "@/server/intelligence/digest";

export function HealthCard({ health }: { health: HealthScore }) {
  const tone = health.score >= 70 ? "success" : health.score >= 50 ? "warning" : "danger";
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <Card as="section" aria-labelledby="health-heading" className="flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <h2 id="health-heading" className="text-[15px] font-semibold text-fg">Company health</h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">Weighted across delivery, cash, margin and capacity</p>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-5">
        <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`Health score ${health.score} of 100`}>
          <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90">
            <circle cx="48" cy="48" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
            <circle cx="48" cy="48" r={r} fill="none" stroke={`var(--${tone})`} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * health.score) / 100} className="transition-[stroke-dashoffset] duration-700 ease-out-quart" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular leading-none">{health.score}</span>
          </div>
        </div>
        <div>
          <p className={cn("text-lg font-semibold", tone === "success" && "text-success", tone === "warning" && "text-warning", tone === "danger" && "text-danger")}>{health.label}</p>
          <p className="mt-1 text-[13px] text-fg-muted">
            {health.score >= 70 ? "Operations are stable. Focus on the items flagged in today's intelligence." : "Several signals need a decision this week."}
          </p>
        </div>
      </div>
      <ul className="mt-5 space-y-3">
        {health.components.map((c) => (
          <li key={c.label}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="text-fg">{c.label}</span>
              <span className="tabular text-fg-muted">{c.score}</span>
            </div>
            <Progress value={c.score} tone={c.score >= 70 ? "default" : c.score >= 50 ? "warning" : "danger"} label={`${c.label} ${c.score}`} />
            <p className="mt-1 text-xs text-fg-subtle">{c.note}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
