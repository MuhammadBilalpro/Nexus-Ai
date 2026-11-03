import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { Insight, Severity } from "@/server/intelligence/digest";

const SEVERITY: Record<Severity, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-danger" },
  warning: { label: "Watch", cls: "bg-warning" },
  info: { label: "Note", cls: "bg-fg-subtle" },
  positive: { label: "Good", cls: "bg-success" },
};

export function TodaysIntelligence({ insights }: { insights: Insight[] }) {
  const critical = insights.filter((i) => i.severity === "critical").length;
  return (
    <Card as="section" aria-labelledby="intel-heading" padded={false} className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="ai-dot" aria-hidden />
            <h2 id="intel-heading" className="text-[15px] font-semibold text-fg">Today&apos;s Intelligence</h2>
          </div>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            {insights.length === 0 ? "Nothing needs your attention." : `${insights.length} developments, ${critical} critical. Every item is derived from records you can open.`}
          </p>
        </div>
        <Link href="/assistant?q=What%20is%20happening%20in%20my%20company%20today%3F">
          <Button variant="secondary" size="sm">
            <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden /> Discuss
          </Button>
        </Link>
      </div>
      {insights.length === 0 ? (
        <div className="p-5">
          <EmptyState compact title="All quiet" description="No delays, overdue invoices, capacity issues or pending decisions right now." />
        </div>
      ) : (
        <ol className="divide-y divide-line">
          {insights.slice(0, 6).map((i, idx) => (
            <li key={i.id} className="group px-5 py-4 animate-fade-up" style={{ animationDelay: `${idx * 40}ms` }}>
              <div className="flex items-start gap-3">
                <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", SEVERITY[i.severity].cls)} aria-label={SEVERITY[i.severity].label} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[14px] font-medium leading-snug text-fg">{i.title}</p>
                    {i.href && (
                      <Link href={i.href} className="shrink-0 rounded-sm p-1 text-fg-subtle opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 focus-visible:opacity-100" aria-label="Open">
                        <ArrowUpRight className="h-4 w-4" aria-hidden />
                      </Link>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{i.detail}</p>
                  <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
                    {i.facts.map((f) =>
                      f.href ? (
                        <Link key={f.label + f.value} href={f.href} className="text-xs text-fg-subtle underline-offset-4 hover:text-fg hover:underline">
                          <span className="text-fg-muted">{f.label}</span> {f.value}
                        </Link>
                      ) : (
                        <span key={f.label + f.value} className="text-xs text-fg-subtle">
                          <span className="text-fg-muted">{f.label}</span> {f.value}
                        </span>
                      ),
                    )}
                  </div>
                  {i.followUp && (
                    <Link href={`/assistant?q=${encodeURIComponent(i.followUp)}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline underline-offset-4">
                      <Sparkles className="h-3 w-3" aria-hidden /> {i.followUp}
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
