import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/server/auth/auth.config";

/**
 * Request proxy (Next.js 16 replacement for middleware).
 *
 * 1. Issues a per-request CSP nonce and strict security headers.
 * 2. Performs an optimistic, cookie-only session check for app routes.
 *    The authoritative check (database session row, roles, MFA) runs in
 *    `requireUser()` inside the server tree — never rely on this alone.
 */
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/login", "/mfa", "/api/health"]);
const AUTH_PREFIX = "/api/auth";

function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Tailwind runtime, Framer Motion and Recharts set inline style attributes; style-src-attr must allow them.
    `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ""}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export default auth(function proxy(request: NextRequest & { auth: unknown }) {
  const { pathname } = request.nextUrl;
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, isDev);

  const session = request.auth as { user?: { id?: string }; mfaPending?: boolean } | null;
  const signedIn = Boolean(session?.user?.id);
  const isPublic = PUBLIC_PATHS.has(pathname) || pathname.startsWith(AUTH_PREFIX);
  const isApi = pathname.startsWith("/api/");

  if (!signedIn && !isPublic) {
    if (isApi) {
      return withSecurityHeaders(NextResponse.json({ error: "Authentication required" }, { status: 401 }), csp);
    }
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(url), csp);
  }
  if (signedIn && session?.mfaPending && !isPublic && !isApi) {
    const url = new URL("/mfa", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(url), csp);
  }
  if (signedIn && pathname === "/login") {
    return withSecurityHeaders(NextResponse.redirect(new URL("/", request.url)), csp);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return withSecurityHeaders(response, csp);
});

function withSecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), browsing-topics=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
