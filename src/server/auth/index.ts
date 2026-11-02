import "server-only";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit/audit";
import { rateLimit, RATE_LIMITS } from "@/server/security/rate-limit";
import { authConfig } from "./auth.config";
import { verifyPassword, getDummyHash } from "./password";
import { createSession, findLiveSession } from "./session-store";
import { metaFromHeaders } from "./request-meta";

function isMfaUpdate(data: unknown): boolean {
  const user = (data as { user?: { mfaVerified?: unknown } } | null)?.user;
  return typeof user === "object" && user !== null && user.mfaVerified === true;
}

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128),
});

/** Single generic error so the UI never distinguishes "no user" from "wrong password". */
class InvalidCredentials extends CredentialsSignin {
  code = "invalid_credentials";
}
class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentials();
        const email = parsed.data.email.toLowerCase();
        const meta = metaFromHeaders(request.headers);

        // Rate limits: per IP and per account (independent counters)
        const [ipLimit, accountLimit] = await Promise.all([
          rateLimit.hit(`login:ip:${meta.ipAddress ?? "unknown"}`, RATE_LIMITS.loginIp),
          rateLimit.hit(`login:acct:${email}`, RATE_LIMITS.loginAccount),
        ]);
        if (!ipLimit.allowed || !accountLimit.allowed) {
          await audit.record({ action: "auth.login", resourceType: "user", outcome: "denied", metadata: { email, reason: "rate_limited" }, ...meta });
          throw new TooManyAttempts();
        }

        const user = await db.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, image: true, passwordHash: true, isActive: true, mfaEnabled: true, lockedUntil: true, failedLoginCount: true },
        });

        // Equalise timing when the account does not exist or has no password.
        const hashToCheck = user?.passwordHash ?? (await getDummyHash());
        const passwordOk = await verifyPassword(hashToCheck, parsed.data.password);

        if (!user || !user.passwordHash || !user.isActive) {
          await audit.record({ action: "auth.login", resourceType: "user", outcome: "denied", metadata: { email, reason: "unknown_or_inactive" }, ...meta });
          throw new InvalidCredentials();
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await audit.record({ action: "auth.login", resourceType: "user", resourceId: user.id, outcome: "denied", metadata: { reason: "locked" }, ...meta });
          throw new TooManyAttempts();
        }
        if (!passwordOk) {
          const failed = user.failedLoginCount + 1;
          await db.user.update({
            where: { id: user.id },
            data: {
              failedLoginCount: failed,
              lockedUntil: failed >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null,
            },
          });
          await audit.record({ action: "auth.login", resourceType: "user", resourceId: user.id, outcome: "denied", metadata: { reason: "bad_password", failed }, ...meta });
          throw new InvalidCredentials();
        }

        // Success: reset counters, open a server-side session row.
        await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
        await rateLimit.reset(`login:acct:${email}`);
        const session = await createSession({ userId: user.id, mfaVerified: !user.mfaEnabled, ...meta });
        await audit.record({ action: "auth.login", resourceType: "user", resourceId: user.id, metadata: { sessionId: session.id, mfaRequired: user.mfaEnabled }, ...meta });

        return { id: user.id, email: user.email, name: user.name, image: user.image, sessionId: session.id, mfaPending: user.mfaEnabled };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      // Server-side `updateSession({ mfaVerified: true })` after a completed MFA step-up:
      // re-encode the cookie immediately so the proxy's optimistic check is not stale.
      if (trigger === "update" && isMfaUpdate(session)) {
        token.mfaPending = false;
        return token;
      }
      if (user) {
        // Initial sign-in: bind the token to the server-side session row.
        token.uid = user.id;
        token.sid = user.sessionId;
        token.mfaPending = user.mfaPending ?? false;
        return token;
      }
      if (!token.sid) return null;
      // Every subsequent request: the session row is the source of truth.
      const live = await findLiveSession(token.sid);
      if (!live) return null; // revoked / expired / deactivated / password changed
      token.mfaPending = live.user.mfaEnabled && !live.mfaVerified;
      return token;
    },
    async session({ session, token }) {
      if (!token.sid || !token.uid) return session;
      const live = await findLiveSession(token.sid);
      if (!live) {
        // Returning an "empty" user makes auth() consumers treat this as signed out.
        return { ...session, user: { ...session.user, id: "", roles: [], mfaEnabled: false, mfaVerified: false, sessionId: "" } };
      }
      session.user = {
        ...session.user,
        id: live.user.id,
        email: live.user.email,
        name: live.user.name,
        image: live.user.image,
        roles: live.user.roles.map((r) => r.role.key),
        mfaEnabled: live.user.mfaEnabled,
        mfaVerified: live.mfaVerified,
        sessionId: live.id,
      };
      return session;
    },
  },
  events: {
    async signOut(message) {
      const sid = "token" in message ? message.token?.sid : undefined;
      if (sid) {
        await db.session.deleteMany({ where: { id: sid } });
        await audit.record({ action: "auth.logout", resourceType: "session", resourceId: sid });
      }
    },
  },
});
