# NEXUS AI — The Autonomous Business Operating System

Enterprise-grade, security-first operating system for a company spanning game development, web and software engineering, design and client services. A CEO opens one interface, understands the company's position, talks to specialised AI agents and approves automated operations.

**Status: Phase 1 foundation complete; v2 redesign shipped.** A calm, AI-native interface: Executive Home with *Today's Intelligence*, the NEXUS Assistant (deterministic answer engine over company records, proposed actions with human approval), an Agent workspace, Business Intelligence views, a Project workspace (board / table / timeline / detail) and an Automation Studio with a visual workflow builder. Authentication with MFA, RBAC, an immutable audit trail and a security-first architecture underneath. See `docs/architecture.md`, `docs/design-language.md` and `docs/security.md`.

> The AI layer is honest by design: until the Phase 3 LLM integration, answers and insights are computed by rules over real records, every figure is traceable to its source, and nothing executes without a human decision.

## Quick start

Requirements: Node.js 22+, PostgreSQL 16 (or Docker).

```bash
# 1. Database (or point DATABASE_URL at your own Postgres)
docker compose up -d db

# 2. Configuration
cp .env.example .env
#   AUTH_SECRET / MFA_ENCRYPTION_KEY:  openssl rand -base64 32
#   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD: first Super Admin (≥ 12 chars)
#   DEMO_MODE=true to load a labelled demo dataset

# 3. Install, migrate, seed
npm install
npm run db:generate
npm run db:migrate          # prisma migrate deploy
npm run db:seed

# 4. Run
npm run dev                 # http://localhost:3000
```

Sign in with the seeded admin, then open **Security** to enrol an authenticator app.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js lifecycle (build runs `prisma generate` first) |
| `npm run typecheck` · `lint` · `test` | Quality gates (also run in CI) |
| `npm run check` | All gates plus a production build |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Create a new migration from schema changes |
| `npm run db:migrate:sql` | Engine-free fallback runner for environments that cannot download Prisma's schema engine |
| `npm run db:seed` | Roles, departments, initial admin, optional demo data |

## Environment

All variables are validated at boot (`src/lib/env.ts`). See `.env.example`. Never commit `.env`.

## Project layout

```
src/app         routes (App Router)        src/server    server-only business layer
src/components  design system & shell      src/lib       env, formatting, utils
src/features    feature slices             prisma/       schema, SQL migrations, seed
src/proxy.ts    security headers + gate    tests/        unit & security tests
docs/           architecture · security · api
```

## Deploy to Vercel (free tier)

1. Import the GitHub repo in Vercel (framework: Next.js, defaults are fine — `vercel-build` runs migrations and the seed).
2. **Storage → Create → Neon (Postgres, free)** and connect it to the project: this injects `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. Add environment variables: `AUTH_SECRET`, `MFA_ENCRYPTION_KEY` (both `openssl rand -base64 32`), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and `DEMO_MODE=true` for a public demo (adds the shared `demo@nexus.local` read-only login shown on the sign-in page).
4. Deploy. Sign in as the admin and enrol MFA.

## Security

Security is a non-negotiable requirement. Controls, verification and open items are documented in `docs/security.md`. Report findings privately.

## Roadmap

1. **Foundation** — ✅ this release
2. **Business modules** — projects (Kanban/table/detail), finance, team, clients
3. **AI intelligence** — AI Command Center, Executive / Project / Finance agents, agent management
4. **Automation** — workflow engine, GitHub integration, notifications, human approvals, execution logs
5. **Advanced** — Game QA agent, Development Assistant, opportunity hunter, advanced analytics
6. **Production readiness** — security audit, performance, Docker/AWS, documentation

## License

Proprietary — all rights reserved.
