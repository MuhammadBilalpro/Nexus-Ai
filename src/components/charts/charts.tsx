"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Chart primitives tuned for the design language: one quiet ink colour for
 * the primary series, a muted second series, hairline gridlines, no legend
 * chrome. Colours come from CSS variables so dark mode is automatic.
 */
const TICK = { fill: "var(--fg-subtle)", fontSize: 11 } as const;
const GRID = "var(--line)";

export interface SeriesPoint {
  label: string;
  [key: string]: string | number;
}

export interface SeriesSpec {
  key: string;
  name: string;
  color?: string; // CSS var reference, defaults to ink
  muted?: boolean;
}

function TooltipCard({ active, payload, label, money }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-fg">{label}</p>
      <div className="space-y-0.5 tabular">
        {payload.map((p) => (
          <p key={p.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-fg-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} aria-hidden /> {p.name}
            </span>
            <span className="font-medium text-fg">{money ? formatMoney(p.value) : p.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function AreaTrend({ data, series, money = true, height = 240, className, ariaLabel }: { data: SeriesPoint[]; series: SeriesSpec[]; money?: boolean; height?: number; className?: string; ariaLabel: string }) {
  return (
    <div className={cn("w-full", className)} style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -14 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? "var(--fg)"} stopOpacity={s.muted ? 0.06 : 0.12} />
                <stop offset="100%" stopColor={s.color ?? "var(--fg)"} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={TICK} tickFormatter={(v: number) => (money ? formatMoney(v, "USD", { compact: true }) : String(v))} width={64} />
          <Tooltip content={<TooltipCard money={money} />} cursor={{ stroke: "var(--line-strong)", strokeDasharray: "3 3" }} />
          {series.map((s) => (
            <Area key={s.key} type="monotone" name={s.name} dataKey={s.key} stroke={s.color ?? (s.muted ? "var(--fg-subtle)" : "var(--fg)")} strokeWidth={s.muted ? 1.25 : 1.75} fill={`url(#fill-${s.key})`} isAnimationActive animationDuration={700} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LineTrend({ data, series, money = false, height = 220, className, ariaLabel }: { data: SeriesPoint[]; series: SeriesSpec[]; money?: boolean; height?: number; className?: string; ariaLabel: string }) {
  return (
    <div className={cn("w-full", className)} style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -14 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={TICK} width={48} tickFormatter={(v: number) => (money ? formatMoney(v, "USD", { compact: true }) : String(v))} />
          <Tooltip content={<TooltipCard money={money} />} cursor={{ stroke: "var(--line-strong)" }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" name={s.name} dataKey={s.key} stroke={s.color ?? (s.muted ? "var(--fg-subtle)" : "var(--accent)")} strokeWidth={1.75} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} isAnimationActive animationDuration={700} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Per-bar colour comes from an optional `color` field on each point (serialisable, so server components can set it). */
export function Bars({ data, dataKey, name, money = true, height = 220, className, ariaLabel, horizontal = false }: { data: SeriesPoint[]; dataKey: string; name: string; money?: boolean; height?: number; className?: string; ariaLabel: string; horizontal?: boolean }) {
  return (
    <div className={cn("w-full", className)} style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 4, right: 8, bottom: 0, left: horizontal ? 8 : -14 }} barCategoryGap={horizontal ? 6 : 12}>
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={GRID} />
          {horizontal ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} tick={TICK} tickFormatter={(v: number) => (money ? formatMoney(v, "USD", { compact: true }) : String(v))} />
              <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} tick={TICK} width={140} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={TICK} dy={6} />
              <YAxis tickLine={false} axisLine={false} tick={TICK} width={56} tickFormatter={(v: number) => (money ? formatMoney(v, "USD", { compact: true }) : String(v))} />
            </>
          )}
          <Tooltip content={<TooltipCard money={money} />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey={dataKey} name={name} radius={[4, 4, 4, 4]} isAnimationActive animationDuration={600} maxBarSize={28}>
            {data.map((p, i) => (
              <Cell key={i} fill={typeof p.color === "string" ? p.color : "var(--fg)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny inline sparkline for stat tiles. */
export function Sparkline({ values, className, color = "var(--fg-muted)" }: { values: number[]; className?: string; color?: string }) {
  const data = values.map((v, i) => ({ label: String(i), v }));
  return (
    <div className={cn("h-8 w-24", className)} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.25} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
