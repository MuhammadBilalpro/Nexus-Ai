import { Prisma } from "@/generated/prisma/client";

/**
 * Money arithmetic lives here and only here. Values are decimal.js
 * instances (Prisma.Decimal); the UI receives fixed-point strings.
 * Never convert to Number before summing.
 */
export type Money = Prisma.Decimal;

export const ZERO: Money = new Prisma.Decimal(0);

export function money(value: Prisma.Decimal | string | number | null | undefined): Money {
  if (value === null || value === undefined) return ZERO;
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function sum(values: readonly (Prisma.Decimal | string | null | undefined)[]): Money {
  return values.reduce<Money>((acc, v) => acc.plus(money(v)), ZERO);
}

export function subtract(a: Money, b: Money): Money {
  return a.minus(b);
}

/** Serialise to a 2-dp string for transport to the client. */
export function toFixed(value: Money): string {
  return value.toFixed(2);
}

/**
 * Percentage change from `previous` to `current`, rounded to 1 dp.
 * Returns null when there is no meaningful baseline.
 */
export function percentChange(current: Money, previous: Money): number | null {
  if (previous.isZero()) return current.isZero() ? 0 : null;
  return Number(current.minus(previous).div(previous).times(100).toFixed(1));
}

/** Margin as a percentage of revenue, or null when revenue is zero. */
export function marginPercent(profit: Money, revenue: Money): number | null {
  if (revenue.isZero()) return null;
  return Number(profit.div(revenue).times(100).toFixed(1));
}
