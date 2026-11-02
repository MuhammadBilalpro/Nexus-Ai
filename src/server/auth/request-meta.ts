import "server-only";
import { headers } from "next/headers";

export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Best-effort client metadata for audit logs and rate limiting.
 * In production Nginx must set X-Forwarded-For; we take the first hop only.
 */
export function metaFromHeaders(h: Headers): RequestMeta {
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() ?? null : h.get("x-real-ip");
  return { ipAddress: ip && ip.length <= 64 ? ip : null, userAgent: h.get("user-agent") };
}

export async function requestMeta(): Promise<RequestMeta> {
  return metaFromHeaders(await headers());
}
