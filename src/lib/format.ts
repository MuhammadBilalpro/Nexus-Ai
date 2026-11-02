/**
 * Formatting helpers. Money arrives as decimal strings from the server
 * (never floats); formatting is presentation-only.
 */
export function formatMoney(amount: string | number, currency = "USD", opts: { compact?: boolean } = {}): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: opts.compact ? 1 : 0,
    notation: opts.compact ? "compact" : "standard",
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDate(date: Date | string, style: "short" | "medium" = "medium"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", style === "short" ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" }).format(d);
}

export function formatRelative(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  const minute = 60_000, hour = 3_600_000, day = 86_400_000;
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < day * 30) return rtf.format(Math.round(diffMs / day), "day");
  return formatDate(d);
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  if (!name) return fallback;
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || fallback;
}

export function humanize(key: string): string {
  return key.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  CEO: "CEO",
  PROJECT_MANAGER: "Project Manager",
  FINANCE_MANAGER: "Finance Manager",
  DEVELOPER: "Developer",
  QA_ENGINEER: "QA Engineer",
  VIEWER: "Viewer",
};

export function roleLabel(key: string): string {
  return ROLE_LABELS[key] ?? humanize(key);
}
