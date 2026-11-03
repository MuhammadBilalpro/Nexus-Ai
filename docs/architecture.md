# NEXUS AI — Architecture (Phase 1)

NEXUS AI is a Next.js 16 application backed by PostgreSQL. Phase 1 delivers the foundation every later module builds on: the design system, authentication with MFA, role-based authorization, an append-only audit trail, and the executive dashboard shell reading live records.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack), React 19, strict TypeScript | `src/proxy.ts` replaces the deprecated `middleware.ts` |
| Styling | Tailwind CSS v4 (`@theme` tokens), shadcn-style primitives in `components/ui`, Lucide, Framer Motion, Recharts | Tokens live in `src/app/globals.css` |
| Data | PostgreSQL 16, Prisma 7 (`@prisma/adapter-pg`) | All money columns are `Decimal(14,2)` |
| Auth | Auth.js v5 (credentials), Argon2id, TOTP MFA, server-side session rows | See `docs/security.md` |
| Validation | Zod 4 at every Server Action / Route Handler boundary | `.strict()` schemas block mass assignment |
| Tests | Vitest (unit + security integration against a test DB) | `npm test` |
| Delivery | GitHub Actions, Docker (standalone, non-root) | AWS/Nginx wiring arrives in Phase 6 |

## Request lifecycle

```
Browser ──► src/proxy.ts ──► App Router segment ──► Server Component / Server Action
             │                                       │
             │ CSP nonce + security headers           ├─ requireUser()/requirePermission()   (src/server/auth/principal.ts)
             │ optimistic cookie check (no DB)        ├─ assertCan(principal, permission)    (src/server/policies)
             │ MFA-pending → /mfa                     ├─ feature query / service            (src/features/**/queries, src/server/**)
             └─ anonymous → /login (JSON 401 on /api) └─ audit.record(...)                   (src/server/audit)
```

Two independent checks protect every protected page or mutation:

1. **Proxy (optimistic).** Decodes the session JWT from the cookie only. Cheap, runs on every request, never touches the database. It exists for UX (fast redirects) and defence in depth — never as the sole guard.
2. **Server tree (authoritative).** `getCurrentUser()` resolves the JWT's `sid` claim to a row in `Session`, loads roles fresh, and checks `isActive`, expiry and `passwordChangedAt`. `assertCan()` then applies the permission matrix. Server Actions and Route Handlers call `requirePermissionStrict()` which throws instead of redirecting.

## Why Cache Components / PPR are off

Next.js 16 scaffolds with `cacheComponents: true` (partial prerendering by default). The bundled docs state PPR is incompatible with nonce-based CSP because static-shell scripts cannot receive a per-request nonce. The security specification requires a strict CSP, and the dashboard is authenticated and per-request anyway, so Phase 1 ships with Cache Components disabled and a `'strict-dynamic'` nonce CSP issued in the proxy. Revisit if public, cacheable pages are added.

## Folder structure

```
src/
├── app/
│   ├── (auth)/           login, mfa — public shells
│   ├── (dashboard)/      authenticated area; layout enforces requireUser()
│   ├── api/auth/…        Auth.js handlers
│   ├── api/health        readiness probe
│   ├── layout.tsx, error.tsx, not-found.tsx, globals.css
├── proxy.ts              CSP/security headers + optimistic session gate
├── components/
│   ├── ui/               design-system primitives (no data access)
│   ├── dashboard/        shell, sidebar, user menu, banners
│   └── charts/           Recharts wrappers
├── features/<module>/    feature slice: actions/ (Server Actions), components/, queries/, schemas.ts
│   ├── auth/
│   └── dashboard/
├── server/               server-only business layer
│   ├── auth/             Auth.js config, password, MFA, session store, principal helpers
│   ├── policies/         permission vocabulary, role matrix, can()/assertCan()
│   ├── audit/            append-only audit writer
│   ├── security/         rate limiter
│   ├── finance/          Decimal money arithmetic
│   └── db.ts             Prisma client singleton
├── lib/                  env validation, formatting, cn()
├── generated/prisma/     generated client (git-ignored)
└── types/                module augmentations
prisma/                   schema, hand-authored SQL migrations, seed
scripts/migrate-sql.ts    engine-free migration runner (same bookkeeping as `prisma migrate deploy`)
tests/                    unit/, security/, stubs/
docs/                     architecture, security, api
```

### Layering rules (enforced by ESLint)

- `components/**`, `features/**/components/**`, `hooks/**` may **not** import `@/server/*`, `@/lib/env` or the Prisma client. UI talks to the server through Server Actions in `features/**/actions` and receives read models as props.
- Money arithmetic happens only in `src/server/finance/money.ts` using `Prisma.Decimal`; the UI receives fixed-point strings and only formats them.
- Every mutating service writes an audit record; the `AuditLog` table has database triggers rejecting `UPDATE`/`DELETE`.
- Demo rows carry `isDemo = true`. Read models exclude them unless `DEMO_MODE=true`, and the UI shows a persistent banner whenever demo mode is on.

## Database

Schema: `prisma/schema.prisma`. Highlights:

- `User`, `Account`, `Session`, `VerificationToken` — Auth.js adapter shape, extended with lockout counters, `passwordChangedAt`, `mfaEnabled`, and per-session `mfaVerified`.
- `MfaSecret` (AES-256-GCM encrypted TOTP secret) and `RecoveryCode` (hashed, single-use).
- `Role` (seeded from `RoleKey` enum) and `UserRole` (many-to-many).
- `Department`, `Client`, `Project`, `ProjectMember`, `Task`, `Invoice`, `Expense`, `ClientApproval`, `Activity` — the minimal business core the dashboard reads; Phase 2 extends these.
- `AuditLog` — immutable. `RateLimit` — fixed-window counters (no Redis needed yet).
- Check constraints keep `progress` within 0–100 and money non-negative.

### Migrations

Migrations are plain SQL under `prisma/migrations/*/migration.sql` and are applied with `npm run db:migrate` (`prisma migrate deploy`). The initial migration was hand-authored following Prisma's naming conventions, so a future `prisma migrate dev` produces no drift. `npm run db:migrate:sql` is an engine-free fallback that performs the same bookkeeping in `_prisma_migrations`; use it only where Prisma's schema-engine binary cannot be downloaded.

## Redesign (v2) — workspaces

The interface was rebuilt around an AI-native executive experience (see `docs/design-language.md` for the visual contract):

| Workspace | Route | Reads | Writes |
|---|---|---|---|
| Executive Home | `/` | KPIs, Today's Intelligence (`server/intelligence/digest.ts`), company health score | — |
| Assistant | `/assistant` | Deterministic intent engine (`server/assistant/engine.ts`) over records; conversations per user | Conversation/Message rows, ProposedAction rows, AgentRun rows |
| Agents | `/agents`, `/agents/[key]` | Agent definitions, runs, pending actions | Approve/reject proposed actions, pause/resume agents |
| Insights | `/insights` | Revenue, profitability, projects, workload, clients, rule-based opportunities | — |
| Projects | `/projects`, `/projects/[slug]` | Board/table/timeline, milestones, tasks, team, activity | Create project/task, status changes, assignments, milestone completion (health recomputed in `features/projects/health.ts`) |
| Automation | `/automation`, `/automation/[id]` | Workflows, steps, runs | Build/edit workflows, enable/disable, dry-run (records a WorkflowRun, no side effects) |

**AI honesty model.** Phase 3 has not added an LLM yet. "Today's Intelligence" and the Assistant are a deterministic rule/intent layer that only reports figures computed by the database, and every answer carries the facts and sources it used. Proposed actions are persisted and require an explicit human decision; approval marks them for the Phase 4 execution engine rather than pretending to execute. Integrations that are not connected (GitHub, email) are labelled as such everywhere.

## Dashboard read models

`src/features/dashboard/queries/overview.ts` computes every KPI from records with Prisma aggregates or grouped SQL, wrapped in React `cache()` so one request never repeats a query. Financial KPIs and the revenue chart render only for principals with `dashboard:view_financials`. Each widget streams inside its own `<Suspense>` boundary with a matching skeleton.

## What is deliberately not here yet

- No AI, LangGraph or OpenAI dependency (Phase 3). The `agent:*` permissions and the audit log already anticipate agent tool calls.
- No integrations (GitHub, Slack, email) and no n8n (Phase 4). Nothing in the UI pretends otherwise: roadmap entries in the sidebar are non-interactive and labelled by phase.
- No Redis. Rate limiting and sessions are Postgres-backed; swap in Redis when horizontal scale demands it.
