# Architecture

## Shape

```
                    ┌──────────────────────────────────────────┐
                    │  Browser — static SPA (Next.js export)   │
                    │  React 19 · Tailwind · hand-built UI      │
                    │  holds only the Supabase anon key        │
                    └───────────────┬──────────────────────────┘
                                    │  HTTPS (PostgREST + Functions)
                    ┌───────────────▼──────────────────────────┐
                    │  Supabase                                │
                    │  ├── Auth (email/password, magic link)   │
                    │  ├── Postgres  ← RLS on every table      │
                    │  │    ├── views (security_invoker)       │
                    │  │    ├── RPCs (security definer)        │
                    │  │    └── triggers (totals, profiles)    │
                    │  ├── Edge Functions (Deno)               │
                    │  │    ├── gbp-sync        (service role) │
                    │  │    ├── gbp-oauth-callback             │
                    │  │    └── ai-draft        (model key)    │
                    │  └── pg_cron → hourly gbp-sync           │
                    └───────────────┬──────────────────────────┘
                                    │
                    ┌───────────────▼──────────────────────────┐
                    │  Google Business Profile API             │
                    │  SERP data provider (rank snapshots)     │
                    │  AI provider (reply drafting)            │
                    └──────────────────────────────────────────┘
```

## Why a static SPA rather than server rendering

The product is a signed-in dashboard. There is no SEO surface worth server-rendering, and the deployment target
(GitHub Pages, Netlify static) rules out a Node runtime. Moving authorisation into Postgres (RLS) and privileged
work into Edge Functions gives the same security posture as an API server, with a fraction of the operational
surface: no server to patch, no cold starts on the hot path, and a cacheable shell that loads in ~105 kB of
shared JS.

The trade-off is honest: no server-side rendering for the marketing page, and the first paint of a dashboard is a
skeleton rather than content. Both are acceptable for a tool used daily behind a login.

## Frontend architecture

- **Route segments** under `src/app`, each a client component wrapped in `PageGuard`, which redirects
  unauthenticated users to `/login` and users without a workspace to `/onboarding`.
- **One store**, `src/lib/data/store.tsx`, exposes session, organisations, role, workspace data and every
  mutation. It has two backends behind one interface: Supabase and an in-memory demo dataset persisted to
  `localStorage`. The UI is written once and cannot tell them apart — which is also how the demo stays honest.
- **Domain logic is pure and separate** (`src/lib/domain`): audit rules, review drafting and sentiment, hours
  normalisation and grouping, KPI maths, rank summaries, CSV, Zod schemas, permission matrix. Every one of these
  is unit-tested without a DOM or a database.
- **Design system** in `src/components/ui`: primitives, overlays (modal, drawer, toast, menu, confirm), charts and
  table. No component library — the visual language is small enough to own, and this avoids the interchangeable
  "AI SaaS dashboard" look that comes from default shadcn theming.

### Rendering and performance

- Static export, per-route code splitting (largest route ~8 kB of page code).
- Aggregate work (audit scores, KPI rollups, series) is memoised per data change; the dashboard does one pass
  over locations, reviews and metrics rather than filtering per card.
- Tables paginate at 12 rows; review and activity lists cap at 400/60 rows server-side.
- Charts are inline SVG generated from a pure function, so there is no chart runtime and no layout thrash.
- The store holds a 30-day metric window, not the full history.

## Backend architecture

There is no bespoke API layer. PostgREST exposes tables and views under RLS; anything that must bypass RLS is an
explicit `security definer` RPC with its own authorisation check:

| RPC | Purpose | Authorisation |
| --- | --- | --- |
| `create_organization(name, slug)` | bootstrap the first workspace | authenticated only; inserts owner membership atomically |
| `add_member_by_email(org, email, role)` | team growth | requires owner/admin; enforces seat limit |
| `remove_member(org, user)` | team removal | requires owner/admin; refuses to remove an owner |

Views (`v_location_health`, `v_review_queue`, `v_portfolio_rollup`) are declared `security_invoker = true` so
they inherit the caller's RLS rather than the definer's rights — the classic Supabase view leak, closed.

### Background processing

`gbp-sync` runs hourly via `pg_cron` + `pg_net`. It refreshes the OAuth token if it is within two minutes of
expiry, walks accounts → locations → reviews, upserts with conflict targets (`org_id,gbp_location_id` and
`location_id,gbp_review_id`) so re-runs are idempotent, and records an activity event per org. A failure marks
the connection `error` rather than failing silently.

Bulk edits are deliberately *not* queued: they run in the request path with a per-outlet result written to
`bulk_job_items`, because a brand manager wants to see which outlet failed while they are still looking at the
screen. At a few hundred outlets this is the right call; the schema already supports moving it to a worker when
that stops being true.

### Caching

No application cache. Postgres indexes cover the access paths that matter (`org_id,status` on locations,
`org_id,status,published_at` on reviews, `org_id,captured_on` on metrics). The static shell is cached at the CDN.
Service worker caching is deliberately absent — stale dashboards are worse than a spinner.

## Database architecture

Three migrations, applied in order:

1. `…000000_schema.sql` — enums, thirteen tables, indexes, constraints, `updated_at` triggers, and the
   `auth.users → profiles` trigger.
2. `…000100_functions.sql` — `is_member`, `has_role`, `my_role`, the three RPCs, and the three reporting views.
3. `…000200_rls.sql` — RLS enablement, policies, grants and revokes.

Design decisions worth naming:

- **Membership as the single source of truth for authorisation.** Every policy resolves through `is_member` /
  `has_role`, so there is exactly one place where "who can see this org" is defined.
- **Enum types over text.** A bad status cannot be written, even by a service-role script.
- **Denormalised totals on purpose.** `locations.audit_score` and `locations.photo_count` are stored because the
  portfolio list sorts and filters on them; the score is recomputed by the app from the same rule engine, so the
  stored value can never drift from the displayed one for long.
- **`connection_secrets` is a separate table with no policies.** Token storage is not "protected by a policy" —
  it is unreachable from the client role entirely.

## Error handling

- Every mutation in the store throws a typed `Error` with the database message; every caller catches and surfaces
  it as a toast or an inline field error. Nothing fails silently.
- Forms validate with Zod before submission and show per-field messages; the database repeats the check.
- Loading, empty, error and success states exist for every list and every form.
- The connection object carries an `error` status so a broken integration is visible in Settings rather than
  inferred from stale data.
- A corrupt `localStorage` demo payload falls back to a fresh dataset instead of crashing the app.

## Observability

- Activity events give a business-level audit trail (who, what, when, which outlet).
- Edge Functions log provider failures with status codes and never log tokens.
- Client errors surface in the UI with enough context to act on; there is no silent catch in the mutation path.
- Recommended next step for production: Sentry for the client and Supabase log drains for the functions.

## Deployment

- **Netlify**: `pnpm build` → publish `out/`. No plugin, no runtime.
- **GitHub Pages**: Actions workflow builds, typechecks, tests and publishes `out/` with `NEXT_PUBLIC_BASE_PATH`
  set to the repository name so assets resolve under the project subpath, plus `.nojekyll`.
- **Supabase**: `supabase db push` for migrations, `supabase functions deploy` for the three functions,
  `supabase/cron/schedule_sync.sql` once for the hourly schedule.

## Environment configuration

| Variable | Where | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | build + browser | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build + browser | public (RLS is the control) |
| `NEXT_PUBLIC_BASE_PATH` | build only | public, affects asset paths |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions, seed script | never in the client |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Edge Functions | secret |
| `GOOGLE_OAUTH_REDIRECT_URL` | Edge Functions | secret-ish |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | Edge Functions | secret |
