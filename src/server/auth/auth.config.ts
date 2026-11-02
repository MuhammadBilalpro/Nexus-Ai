import type { NextAuthConfig } from "next-auth";

/**
 * Base Auth.js configuration shared by the full server config and the
 * request proxy. It must stay free of database imports so `proxy.ts`
 * can perform a cheap, cookie-only (optimistic) session check.
 * The authoritative check with database lookup happens in `auth()`.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60,
    updateAge: 15 * 60,
  },
  cookies: {
    sessionToken: {
      name: "nexus.session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [], // supplied by the full config
  callbacks: {
    /**
     * Always true: proxy.ts performs its own redirects (public paths, MFA step-up,
     * JSON 401 for API routes) instead of Auth.js' generic sign-in redirect.
     */
    authorized() {
      return true;
    },
    /**
     * Proxy-only projection: expose the user id and MFA-pending flag from the
     * token without touching the database. The full config replaces this.
     */
    session({ session, token }) {
      return {
        ...session,
        user: { ...session.user, id: token.uid ?? token.sub ?? "" },
        mfaPending: token.mfaPending === true,
      };
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
