import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import type { RoleKey } from "@/generated/prisma/enums";

export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 hours absolute
export const SESSION_IDLE_SECONDS = 2 * 60 * 60; // 2 hours idle timeout

/**
 * Server-side session records. The browser holds an encrypted JWT whose
 * `sid` claim points at one of these rows; deleting the row revokes the
 * session immediately regardless of the token's own expiry.
 */
export async function createSession(input: {
  userId: string;
  mfaVerified: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ id: string; expires: Date }> {
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const token = crypto.randomUUID();
  const session = await db.session.create({
    data: {
      sessionToken: token,
      userId: input.userId,
      expires,
      mfaVerified: input.mfaVerified,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
    },
    select: { id: true, expires: true },
  });
  return session;
}

export interface LiveSession {
  id: string;
  userId: string;
  mfaVerified: boolean;
  expires: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    isActive: boolean;
    mfaEnabled: boolean;
    passwordChangedAt: Date | null;
    roles: { role: { key: RoleKey } }[];
  };
}

/**
 * Returns null when the session is missing, expired, or the user is deactivated.
 * Wrapped in React `cache` so the jwt and session callbacks share one query per request.
 */
export const findLiveSession = cache(async function findLiveSession(sessionId: string): Promise<LiveSession | null> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      mfaVerified: true,
      expires: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          isActive: true,
          mfaEnabled: true,
          passwordChangedAt: true,
          roles: { select: { role: { select: { key: true } } } },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expires.getTime() <= Date.now()) return null;
  if (!session.user.isActive) return null;
  // Password change after session creation invalidates the session.
  if (session.user.passwordChangedAt && session.user.passwordChangedAt > session.createdAt) return null;
  return session;
});

export async function markMfaVerified(sessionId: string): Promise<void> {
  await db.session.update({ where: { id: sessionId }, data: { mfaVerified: true } });
}

export async function revokeSession(sessionId: string): Promise<void> {
  await db.session.deleteMany({ where: { id: sessionId } });
}

export async function revokeAllUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const res = await db.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
  return res.count;
}

export async function listUserSessions(userId: string) {
  return db.session.findMany({
    where: { userId, expires: { gt: new Date() } },
    select: { id: true, createdAt: true, expires: true, ipAddress: true, userAgent: true, mfaVerified: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function sweepExpiredSessions(): Promise<number> {
  const res = await db.session.deleteMany({ where: { expires: { lt: new Date() } } });
  return res.count;
}
