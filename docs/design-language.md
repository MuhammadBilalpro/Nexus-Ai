# NEXUS AI — Design language & implementation conventions

Read this before touching any UI. It is the contract every page follows.

## Philosophy
Calm, minimal, intelligent. Think Apple × Linear × Notion × OpenAI. Information hierarchy first; whitespace is a feature. **No** gradients as decoration, no neon, no glow, no glass, no "futuristic" chrome, no emoji in UI copy. Every visible button does something real.

## Tokens (src/app/globals.css — use Tailwind utilities, never hex)
- Canvas `bg-bg` (off-white), surfaces `bg-surface` (white) / `bg-surface-2` / `bg-surface-3` (greys)
- Borders: `border-line` (1px, default on all elements) · `border-line-strong` on hover/active
- Text: `text-fg` (charcoal) · `text-fg-muted` · `text-fg-subtle`
- Accent **only for AI/interaction**: `text-accent`, `bg-accent-soft`, `bg-accent`, `.ai-dot` (pulsing dot marks AI-generated content)
- Semantic: `success`, `warning`, `danger` each with a `-soft` background
- Radii: `rounded-xs|sm|md|lg|xl` (6/8/10/14/20). Cards use `rounded-lg`
- Shadows: `shadow-sm` on buttons, `shadow-md` only on floating things (menus, palettes). Cards have **no** shadow
- Motion: `animate-fade-in`, `animate-fade-up` (stagger with `style={{animationDelay}}`), `ease-out-quart`. Prefer transitions ≤ 200 ms. Respect reduced motion (handled globally)
- Dark mode is automatic via tokens (`[data-theme=dark]`); never write `dark:` variants

## Primitives (src/components/ui)
`Button` (variants primary/accent/secondary/ghost/danger/link; sizes xs/sm/md/lg/icon; `loading`), `Input`/`Textarea`/`Select`, `Label`/`FieldError`/`Hint`, `Card` (+`CardHeader` with title/description/action/eyebrow, `Divider`), `Badge` (neutral/accent/success/warning/danger/outline, `dot`), `Skeleton`/`StatSkeleton`/`CardSkeleton`, `Avatar`, `EmptyState` (`compact`), `ErrorState`, `Tabs` (link-based; `param` for query tabs, else path tabs; `defaultValue`), `Table/THead/TH/TBody/TR/TD`, `Stat`/`Delta`/`Progress`, `Switch`, `Kbd`.
Charts: `src/components/charts/charts.tsx` → `AreaTrend`, `LineTrend`, `Bars` (vertical/horizontal, `colorFor`), `Sparkline`. Ink-coloured primary series, muted secondary; accent sparingly.
Layout helpers: `PageHeader` (title/description/actions/eyebrow), `Logo`.

## Typography scale
Page title 22–26px semibold tight; card title 15px semibold; body 14px; secondary 13px; captions 11–12px. Numbers use `.tabular`.

## Architecture conventions
- Pages are **Server Components** under `src/app/(dashboard)/<area>/…`. The `(dashboard)` layout already enforces auth; pages call `requirePermission("…")` from `@/server/auth/principal` and gate financials with `can(user, "dashboard:view_financials")`.
- Data: `src/features/<area>/queries.ts` (`import "server-only"`, wrap exported fns in React `cache()`, filter demo rows with `env.DEMO_MODE ? {} : { isDemo: false }`). Return plain serialisable objects; money as 2-dp strings via `@/server/finance/money` (`money`, `sum`, `toFixed`, `percentChange`, `marginPercent`). Never do money math in Number.
- Mutations: `src/features/<area>/actions.ts` (`"use server"`), validate with Zod `.strict()`, authorise with `requirePermissionStrict(permission)`, write `audit.record(...)` from `@/server/audit/audit`, then `revalidatePath`. Return `{ ok: true } | { error: string }`. Demo accounts (`user.isDemo`) may read everything but mutations should still work on demo rows (they are demo data) — except security settings.
- UI components live in `src/features/<area>/components/*.tsx`; client components (`"use client"`) must not import `@/server/*` or `@/lib/env` at runtime (type imports are fine). Pass data as props.
- Stream each heavy section in its own `<Suspense>` with a matching skeleton. Use `EmptyState` whenever a list is empty; `ErrorState` is wired through `error.tsx`.
- Formatting: `@/lib/format` → `formatMoney`, `formatNumber`, `formatPercent`, `formatDate`, `formatRelative`, `humanize`, `roleLabel`, `initials`.
- Permissions vocabulary: `@/server/policies` (`dashboard:view`, `dashboard:view_financials`, `project:read|create|update|delete|assign`, `task:*`, `finance:read|write`, `invoice:*`, `expense:*`, `team:read|manage`, `client:read|write`, `approval:read|decide`, `automation:read|manage`, `agent:use|manage`, `audit:read`, …).
- Enums come from `@/generated/prisma/enums`; the Prisma client is `db` from `@/server/db` (server only).
- Honesty rule: no fake integrations. Anything that is not connected (GitHub, email, Slack) is shown as "Not connected" with a clear path, never as working.
- Every interactive control must have an accessible name; tables use real `<table>`; keyboard focus rings are global.
