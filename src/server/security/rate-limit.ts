import { db } from "@/server/db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimitPolicy {
  /** Maximum hits per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export const RATE_LIMITS = {
  loginIp: { limit: 20, windowSeconds: 15 * 60 },
  loginAccount: { limit: 5, windowSeconds: 15 * 60 },
  mfaAttempt: { limit: 6, windowSeconds: 10 * 60 },
  apiDefault: { limit: 120, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitPolicy>;

/**
 * Fixed-window counter stored in PostgreSQL. One atomic upsert per hit:
 * resets the window when it has expired, otherwise increments.
 * Good enough for login protection without adding Redis in Phase 1.
 */
export async function hit(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  const windowMs = policy.windowSeconds * 1000;
  const now = new Date();

  const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < ${new Date(now.getTime() - windowMs)} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${new Date(now.getTime() - windowMs)} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count", "windowStart"
  `;

  const row = rows[0];
  const count = row?.count ?? 1;
  const windowStart = row?.windowStart ?? now;
  const resetAt = windowStart.getTime() + windowMs;
  const allowed = count <= policy.limit;

  return {
    allowed,
    remaining: Math.max(0, policy.limit - count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)),
  };
}

/** Clear a counter, e.g. the per-account login counter after a successful login. */
export async function reset(key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Remove stale rows; call from a scheduled job. */
export async function sweep(olderThanSeconds = 24 * 3600): Promise<number> {
  const res = await db.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - olderThanSeconds * 1000) } },
  });
  return res.count;
}

export const rateLimit = { hit, reset, sweep };
