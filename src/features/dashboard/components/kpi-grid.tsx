import type { LucideIcon } from "lucide-react";
import { FolderKanban, CheckCircle2, AlertTriangle, Banknote, TrendingUp, Receipt, PiggyBank, Gauge, ClipboardCheck, CalendarClock, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";
import { formatMoney, formatNumber } from "@/lib/format";
import type { OverviewKpis } from "../queries/overview";
import { PERIOD_LABELS, type Period } from "../period";

type Tone = "blue" | "violet" | "cyan" | "emerald" | "amber" | "rose";

const TONE_CLASSES: Record<Tone, string> = {
  blue: "text-blue bg-blue/10 border-blue/20",
  violet: "text-violet bg-violet/10 border-violet/20",
  cyan: "text-cyan bg-cyan/10 border-cyan/20",
  emerald: "text-emerald bg-emerald/10 border-emerald/20",
  amber: "text-amber bg-amber/10 border-amber/20",
  rose: "text-rose bg-rose/10 border-rose/20",
};

function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="text-[11px] text-fg-subtle">no prior data</span>;
  const good = invert ? value <= 0 : value >= 0;
  const Icon = value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium tabular", value === 0 ? "text-fg-subtle" : good ? "text-emerald" : "text-rose")}>
      <Icon className="h-3 w-3" aria-hidden />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function Kpi({ label, value, hint, icon: Icon, tone, delta, invert, index }: { label: string; value: string; hint?: React.ReactNode; icon: LucideIcon; tone: Tone; delta?: number | null; invert?: boolean; index: number }) {
  return (
    <GlassCard className="group relative overflow-hidden animate-fade-up" style={{ animationDelay: `${index * 40}ms` }}>
      <div className={cn("pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-60", TONE_CLASSES[tone].split(" ")[1])} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-fg-muted">{label}</p>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border", TONE_CLASSES[tone])}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular">{value}</p>
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-fg-subtle">
        {delta !== undefined && <Delta value={delta} invert={invert} />}
        {hint}
      </div>
    </GlassCard>
  );
}

export function KpiGrid({ kpis, period, showFinancials }: { kpis: OverviewKpis; period: Period; showFinancials: boolean }) {
  const label = PERIOD_LABELS[period].toLowerCase();
  const profitNegative = kpis.periodProfit.value.startsWith("-");
  const items = [
    { label: "Active projects", value: formatNumber(kpis.activeProjects), icon: FolderKanban, tone: "blue" as Tone, hint: "in delivery now" },
    { label: "Completed", value: formatNumber(kpis.completedProjects), icon: CheckCircle2, tone: "emerald" as Tone, hint: `delivered ${label}` },
    { label: "Delayed", value: formatNumber(kpis.delayedProjects), icon: AlertTriangle, tone: kpis.delayedProjects > 0 ? ("rose" as Tone) : ("emerald" as Tone), hint: "past deadline or flagged" },
    { label: "Total revenue", financial: true, value: formatMoney(kpis.totalRevenue, "USD", { compact: true }), icon: Banknote, tone: "violet" as Tone, hint: "all-time, paid invoices" },
    { label: "Revenue", financial: true, value: formatMoney(kpis.periodRevenue.value), icon: TrendingUp, tone: "cyan" as Tone, delta: kpis.periodRevenue.delta, hint: `vs previous ${period === "today" ? "day" : period}` },
    { label: "Operating expenses", financial: true, value: formatMoney(kpis.periodExpenses.value), icon: Receipt, tone: "amber" as Tone, delta: kpis.periodExpenses.delta, invert: true, hint: label },
    { label: "Estimated profit", financial: true, value: formatMoney(kpis.periodProfit.value), icon: PiggyBank, tone: profitNegative ? ("rose" as Tone) : ("emerald" as Tone), hint: kpis.periodProfit.margin === null ? "no revenue yet" : `${kpis.periodProfit.margin}% margin · revenue − expenses` },
    { label: "Team productivity", value: kpis.productivity.percent === null ? "—" : `${kpis.productivity.percent}%`, icon: Gauge, tone: "blue" as Tone, hint: `${kpis.productivity.completedTasks} of ${kpis.productivity.totalTasksDue} due tasks done` },
    { label: "Pending approvals", value: formatNumber(kpis.pendingApprovals), icon: ClipboardCheck, tone: kpis.pendingApprovals > 0 ? ("amber" as Tone) : ("emerald" as Tone), hint: "awaiting clients" },
    { label: "Upcoming deadlines", value: formatNumber(kpis.upcomingDeadlines), icon: CalendarClock, tone: "violet" as Tone, hint: "next 7 days" },
  ].filter((item) => showFinancials || !("financial" in item && item.financial));
  return (
    <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item, i) => (
        <Kpi key={item.label} index={i} label={item.label} value={item.value} hint={item.hint} icon={item.icon} tone={item.tone} delta={"delta" in item ? item.delta : undefined} invert={"invert" in item ? item.invert : undefined} />
      ))}
    </section>
  );
}
