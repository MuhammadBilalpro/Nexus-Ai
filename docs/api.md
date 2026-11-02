# NEXUS AI — API (Phase 1)

Phase 1 exposes no public business API. The UI communicates through Server Actions; every action validates input with Zod and authorises the caller server-side.

## HTTP endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | none | Readiness probe: `{ status: "ok", db: "up" }` or 503 `{ status: "degraded" }` |
| GET/POST | `/api/auth/*` | Auth.js | Sign-in (`/api/auth/callback/credentials`), CSRF token (`/api/auth/csrf`), session (`/api/auth/session`), sign-out |

Anonymous requests to any other `/api/*` route receive `401 { "error": "Authentication required" }` from the proxy before reaching a handler.

## Server Actions

| Action | File | Permission |
|---|---|---|
| `loginAction` | `features/auth/actions/login.ts` | public (rate-limited) |
| `verifyMfaAction`, `logoutAction` | `features/auth/actions/mfa.ts` | signed-in |
| `beginMfaEnrollmentAction`, `confirmMfaEnrollmentAction`, `disableMfaAction` | `features/auth/actions/mfa.ts` | signed-in (own account) |
| `changePasswordAction` | `features/auth/actions/password.ts` | signed-in (own account) |
| `revokeSessionAction`, `revokeOtherSessionsAction` | `features/auth/actions/sessions.ts` | signed-in (own sessions only) |

Error contract: actions return `{ error?: string; fieldErrors?: Record<string,string> }` and never throw raw exceptions to the client. Success paths that change the navigation state call `redirect()`.

## Read models (server-only)

`features/dashboard/queries/overview.ts` — `getOverviewKpis(period)`, `getRevenueTrend()`, `getProjectHealth()`, `getTeamWorkload()`, `getRecentActivity()`, `getUpcomingDeadlines()`, `getCriticalAlerts()`. All return plain serialisable objects; money is a 2-dp decimal string.

Phase 2 introduces versioned REST handlers under `/api/v1/*` with the same `requirePermissionStrict()` guard and rate limiting.
