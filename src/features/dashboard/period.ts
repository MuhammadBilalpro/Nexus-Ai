import { startOfDay, startOfWeek, startOfMonth, startOfYear, subDays, subWeeks, subMonths, subYears } from "date-fns";

export const PERIODS = ["today", "week", "month", "year"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
};

export interface PeriodRange {
  period: Period;
  start: Date;
  end: Date;
  /** Same-length window immediately before `start`, for trend deltas. */
  prevStart: Date;
  prevEnd: Date;
}

export function parsePeriod(value: string | undefined | null): Period {
  return (PERIODS as readonly string[]).includes(value ?? "") ? (value as Period) : "month";
}

export function periodRange(period: Period, now = new Date()): PeriodRange {
  switch (period) {
    case "today": {
      const start = startOfDay(now);
      return { period, start, end: now, prevStart: subDays(start, 1), prevEnd: start };
    }
    case "week": {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      return { period, start, end: now, prevStart: subWeeks(start, 1), prevEnd: start };
    }
    case "year": {
      const start = startOfYear(now);
      return { period, start, end: now, prevStart: subYears(start, 1), prevEnd: start };
    }
    case "month":
    default: {
      const start = startOfMonth(now);
      return { period: "month", start, end: now, prevStart: subMonths(start, 1), prevEnd: start };
    }
  }
}
