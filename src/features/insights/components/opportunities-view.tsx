import Link from "next/link";
import { Sparkles, Repeat, TrendingUp, BookOpen, CircleDashed, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Signal, SignalKind } from "@/features/insights/queries";

const KIND: Record<SignalKind, { label: string; tone: BadgeTone; icon: LucideIcon }> = {
  phase2: { label: "Follow-on", tone: "success", icon: Repeat },
  expand: { label: "Expand", tone: "success", icon: TrendingUp },
  "case-study": { label: "Case study", tone: "neutral", icon: BookOpen },
  "idle-capability": { label: "Idle capability", tone: "warning", icon: CircleDashed },
};

export function OpportunitiesView({ signals }: { signals: Signal[] }) {
  return (
    <section aria-labelledby="opps-heading" className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="opps-heading" className="text-[15px] font-semibold text-fg">Opportunity signals</h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">Derived by fixed rules from your project, invoice and client records. Nothing here is a lead or forecast; each card lists the facts it rests on.</p>
        </div>
        <Badge tone="outline">{signals.length} {signals.length === 1 ? "signal" : "signals"} · rule-based</Badge>
      </div>

      {signals.length === 0 ? (
        <EmptyState title="No signals right now" description="Signals appear when a project completes without a follow-on, a client keeps paying on time, a project nears delivery, or a capability sits idle." />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {signals.map((s, idx) => {
            const k = KIND[s.kind];
            const Icon = k.icon;
            return (
              <li key={s.id} className="animate-fade-up" style={{ animationDelay: `${idx * 40}ms` }}>
                <Card as="article" className="flex h-full flex-col" aria-labelledby={`sig-${s.id}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-line bg-surface-2 text-fg-muted"><Icon className="h-4 w-4" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 id={`sig-${s.id}`} className="text-[14px] font-medium leading-snug text-fg">{s.title}</h3>
                        <Badge tone={k.tone}>{k.label}</Badge>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{s.detail}</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-1 gap-y-1.5 border-t border-line pt-3 text-xs sm:grid-cols-[auto_1fr] sm:gap-x-4">
                    {s.facts.map((f) => (
                      <div key={f.label + f.value} className="contents">
                        <dt className="text-fg-subtle">{f.label}</dt>
                        <dd className="text-fg">{f.href ? <Link href={f.href} className="underline-offset-4 hover:underline">{f.value}</Link> : f.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-auto pt-4">
                    <Link href={`/assistant?q=${encodeURIComponent(s.prompt)}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent underline-offset-4 hover:underline">
                      <Sparkles className="h-3 w-3" aria-hidden /> Draft proposal with the assistant
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
