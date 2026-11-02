# NEXUS AI — Security (Phase 1)

Security posture, controls in place, how they were verified, and what is still open. This document is updated every phase. Passing automated checks does not mean the application is vulnerability-free; see **Known limitations**.

## Authentication

| Control | Implementation | Verified by |
|---|---|---|
| Password hashing | Argon2id, m=64 MiB, t=3, p=4 (`src/server/auth/password.ts`) | `tests/security/auth.test.ts` |
| Password policy | ≥12 chars, ≤128, common-root deny-list, repetition and digit-only checks (NIST 800-63B style) | `tests/unit/schemas.test.ts` |
| User enumeration | Single generic error for unknown user / wrong password; dummy Argon2 verify equalises timing | manual: both paths return `invalid_credentials` |
| Brute force | Per-account limit 5 / 15 min, per-IP 20 / 15 min, account lock after 5 failures for 15 min | manual HTTP test: 6th attempt and a correct password while locked both return `too_many_attempts`; audited |
| Sessions | Encrypted JWT cookie (`nexus.session`, HttpOnly, SameSite=Lax, Secure in prod) bound to a `Session` row via `sid`; 12 h absolute lifetime | `tests/security/auth.test.ts` |
| Revocation | Deleting the row revokes immediately; password change invalidates older sessions; deactivated users are signed out on next request | tests: revoke one / all others / deactivated / password change |
| MFA | TOTP (RFC 6238, 6 digits, 30 s, ±1 step), secret encrypted at rest with AES-256-GCM, 10 single-use hashed recovery codes; step-up enforced in proxy and server tree; MFA attempts rate-limited 6 / 10 min | tests: enrol → confirm → TOTP → recovery (single use) → disable |
| Logout | Server Action → Auth.js signOut; `events.signOut` deletes the session row and audits | manual |
| Open redirects | `safeNextPath()` allows only same-origin relative paths | unit tests |

## Authorization

- Permission vocabulary and role matrix: `src/server/policies/permissions.ts`.
- Decision function `can()` is pure and unit-tested for every role; sensitive permissions (`finance:write`, `user:manage`, `role:assign`, …) additionally require an MFA-verified session.
- Every protected page calls `requirePermission()`, every Server Action `getCurrentUser()`/`requirePermissionStrict()`. Frontend route protection in the proxy is optimistic only.
- IDOR: ownership is checked server-side before acting (e.g. `revokeSessionAction` verifies the session belongs to the caller and audits denied attempts).

## Application security

| Area | Control |
|---|---|
| Input validation | Zod 4 on every boundary; `.strict()` objects reject unknown keys (mass assignment) |
| SQL injection | Prisma query builder; the few raw queries use tagged templates (`$queryRaw`) which parameterise values |
| XSS | React escaping; the only `dangerouslySetInnerHTML` renders a server-generated QR SVG from the `qrcode` library (no user input) |
| CSP | Per-request nonce, `script-src 'self' 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`; dev adds `'unsafe-eval'`/`'unsafe-inline'` for HMR only. `style-src-attr 'unsafe-inline'` is required by Recharts/Framer Motion inline style attributes (not script-capable). |
| Headers | HSTS (prod), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`, COOP; `X-Powered-By` removed |
| CSRF | Auth.js double-submit token on auth endpoints; Next.js Server Actions origin/host check (`experimental.serverActions.allowedOrigins` ready for reverse proxies) |
| Rate limiting | Postgres fixed-window counters (`RateLimit` table); applied to login and MFA. API-wide limiting arrives with the first public API in Phase 2 |
| Secrets | `src/lib/env.ts` validates `process.env` with Zod at boot; `.env` git-ignored; `.env.example` documents keys; nothing secret reaches client bundles (ESLint forbids `@/lib/env` in UI) |
| Error handling | `error.tsx` shows a digest, never a stack; Server Actions return typed error states |
| Audit trail | `AuditLog` table with `BEFORE UPDATE/DELETE` triggers that raise — verified in tests and via psql |
| Demo data | Rows flagged `isDemo`, excluded unless `DEMO_MODE=true`; persistent banner in demo mode |

## Infrastructure

- Least-privilege DB role (`nexus`) owns only the application database.
- Docker image: multi-stage, non-root user, standalone output, health check.
- CI (`.github/workflows/ci.yml`): typecheck, lint, tests against a Postgres service, production build, `npm audit --omit=dev --audit-level=high` (blocking), CodeQL static analysis.

## Dependency audit — 2026-11-02

- **Production dependencies:** `npm audit --omit=dev` → 0 vulnerabilities.
- **Development dependencies:** 16 moderate findings, all one advisory — `minimatch < 11.0.1` (ReDoS, GHSA-g3hv-75wg-m249) pulled transitively by `eslint`, `eslint-config-next`, `@typescript-eslint/*` and `eslint-plugin-*`. These packages never ship to production and only process trusted source files. Tracking upstream; will re-evaluate each phase.

## Known limitations (open)

1. **No email delivery yet** — password reset and email verification flows depend on the email integration planned for Phase 4. Until then administrators reset passwords via the seed/admin tooling.
2. **Proxy session check is optimistic** — by design; a revoked session is rejected on the first server render, not at the proxy.
3. **Rate limiting is per-instance-agnostic but window-based** — fixed windows allow short bursts at window edges; acceptable for login protection, to be replaced by a sliding window/Redis if abuse is observed.
4. **MFA recovery codes are shown once** — there is no regeneration UI yet; disabling and re-enabling MFA issues a fresh set.
5. **Browser end-to-end tests are not in CI yet** — the full login → MFA enrolment → step-up → recovery-code → session-revocation flow was exercised against the production build with headless Chrome (Playwright script) and passed; the suite joins CI in Phase 2.
6. **`trustHost: true`** in the Auth.js config relies on the reverse proxy to set `Host`/`X-Forwarded-Host` correctly; Nginx configuration in Phase 6 must not forward arbitrary client-supplied hosts.
7. **CSP `style-src-attr 'unsafe-inline'`** — required by charting/animation libraries; inline *attributes* cannot execute script, but this will be tightened if those dependencies change.

## Reporting

Security findings should be reported privately to the platform owner, never in a public issue.
