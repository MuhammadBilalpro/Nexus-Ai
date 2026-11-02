"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";

export interface RevenueChartPoint {
  month: string;
  revenue: number;
  expenses: number;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find((p) => p.name === "Revenue")?.value ?? 0;
  const expenses = payload.find((p) => p.name === "Expenses")?.value ?? 0;
  return (
    <div className="glass-strong rounded-md px-3 py-2 text-xs shadow-glass">
      <p className="mb-1.5 font-medium text-fg">{label}</p>
      <div className="space-y-1 tabular">
        <p className="flex items-center justify-between gap-6"><span className="text-fg-muted">Revenue</span><span className="font-medium text-cyan">{formatMoney(revenue)}</span></p>
        <p className="flex items-center justify-between gap-6"><span className="text-fg-muted">Expenses</span><span className="font-medium text-amber">{formatMoney(expenses)}</span></p>
        <p className="flex items-center justify-between gap-6 border-t border-line pt-1"><span className="text-fg-muted">Net</span><span className={revenue - expenses >= 0 ? "font-medium text-emerald" : "font-medium text-rose"}>{formatMoney(revenue - expenses)}</span></p>
      </div>
    </div>
  );
}

export function RevenueChart({ data }: { data: RevenueChartPoint[] }) {
  return (
    <div className="h-[280px] w-full" role="img" aria-label="Monthly revenue and expenses for the last 12 months">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-amber)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--accent-amber)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--fg-subtle)", fontSize: 11 }} dy={6} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--fg-subtle)", fontSize: 11 }} tickFormatter={(v: number) => formatMoney(v, "USD", { compact: true })} width={64} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "3 3" }} />
          <Area type="monotone" name="Expenses" dataKey="expenses" stroke="var(--accent-amber)" strokeWidth={1.5} fill="url(#expFill)" isAnimationActive animationDuration={900} />
          <Area type="monotone" name="Revenue" dataKey="revenue" stroke="var(--accent-cyan)" strokeWidth={2} fill="url(#revFill)" isAnimationActive animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
