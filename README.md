# Kendra

**A local presence manager for multi-location brands.** Kendra keeps every outlet of a brand accurate,
reviewed and ranking on Google — from one screen.

Brands with dozens or hundreds of outlets lose walk-ins to wrong hours, duplicate listings and unanswered
reviews. Enterprise tools that solve this (Birdeye, Yext, Uberall) are priced for the US and Europe. Kendra is
built for the Indian and emerging-market case: ₹ pricing per outlet, GST-ready exports, and workflows that
assume a marketing team of three, not thirty.

---

## What actually works

| Area | What you can do |
| --- | --- |
| **Portfolio dashboard** | Live KPIs (outlets, average audit score, open reviews, 30-day calls), discovery trend chart, health distribution, biggest-wins ranking, review backlog |
| **Outlets** | Search / filter / sort / paginate, add and edit with validated Indian phone and PIN formats, per-outlet drawer with audit findings, hours, photos and sync state, CSV export |
| **Bulk edit** | Hours, description, attributes or re-sync across any selection of outlets; every run records a job with per-outlet success and failure |
| **Reviews** | Inbox filtered by state, rating and outlet; AI-or-template drafted replies; safety checks before posting; reply history with draft provenance |
| **Reports** | 7/30-day views, calls, directions, website clicks with period-over-period deltas; per-outlet table; local rank by keyword; 5×5 rank grid; CSV export |
| **Audit** | 13 deterministic rules, 0–100 score per outlet, portfolio fix ranking by recoverable points, severity filters, CSV export |
| **Team** | Members with four roles, seat limits enforced in the database, add/remove through security-definer RPCs |
| **Settings** | Brand name, colour, plan; Google connection status; environment and security summary |
| **Activity** | Day-grouped audit trail of every change, filterable by kind |

Everything in the UI is wired to real state. There are no dead buttons, no static charts and no placeholder
dashboards. Where a capability needs a credential you have not supplied (Google Business Profile OAuth), the UI
says so explicitly rather than pretending.

### Two data modes

- **Live** — set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` and Kendra talks to your
  Supabase project, with row-level security enforcing every read and write.
- **Demo** — with no Supabase project configured, the app boots a clearly-labelled sample workspace (a fictional
  10-outlet coffee brand) held in your browser. Every number is computed by the same code paths as live data.
  This is what the public demo URL runs, so the product can be evaluated without a signup.

---

## Stack

- **Next.js 15** (App Router, static export) + **React 19** + **TypeScript** (strict)
- **Tailwind CSS 3** with a hand-built design system — no component library, no CSS-in-JS runtime
- **Supabase**: Postgres, Auth, Row Level Security, Edge Functions (Deno), pg_cron
- **Zod** for all input validation, shared between UI and data layer
- **Vitest** for unit tests, a **Python + psycopg** harness for schema and RLS tests, **Playwright** for E2E

Charts and sparklines are hand-rolled SVG (no charting dependency). Icons are `lucide-react`.

Full rationale, including what was evaluated and rejected, is in [`docs/OPEN_SOURCE.md`](docs/OPEN_SOURCE.md)
and [`docs/ADR.md`](docs/ADR.md).

---

## Quick start

```bash
pnpm install
cp .env.example .env.local     # optional — omit to run the demo workspace
pnpm dev                       # http://localhost:3000
```

With no Supabase keys the app opens in demo mode. To use live data:

```bash
# 1. apply the schema to your Supabase project
supabase link --project-ref <ref>
supabase db push               # runs supabase/migrations/*.sql in order

# 2. deploy the Edge Functions
supabase functions deploy gbp-sync gbp-oauth-callback ai-draft
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
  GOOGLE_OAUTH_REDIRECT_URL=https://<ref>.supabase.co/functions/v1/gbp-oauth-callback \
  AI_PROVIDER=none

# 3. optional: seed a demo brand (service role key stays local)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm seed

# 4. point the app at the project
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

The hourly Google sync is scheduled separately once the function is deployed:

```bash
psql "$DATABASE_URL" -f supabase/cron/schedule_sync.sql
```

---

## Tests

```bash
pnpm typecheck     # tsc --noEmit, strict
pnpm lint          # next lint
pnpm test          # 102 tests (Vitest: domain, data layer, jsdom page renders)
pnpm test:db       # 31 schema + RLS assertions against a real Postgres
pnpm test:e2e      # Playwright, runs against a served static build
```

`pnpm test:db` boots an embedded PostgreSQL (`pip install pgserver psycopg[binary]`), applies the migrations in
order, seeds two tenants and then attacks the policies: cross-tenant reads, privilege escalation, secret-table
access, constraint violations, cascade behaviour and view leakage. It needs no Supabase project.

---

## Deploy

**Netlify** — `netlify.toml` is committed. Build command `pnpm build`, publish directory `out`.

**GitHub Pages** — `.github/workflows/deploy-pages.yml` builds, typechecks, tests and publishes `out/` on every
push to `main`. For project sites the workflow sets `NEXT_PUBLIC_BASE_PATH=/<repo>` so assets resolve under
`https://<user>.github.io/<repo>/`. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as
repository secrets to run in live mode; without them the deployment runs the demo workspace.

The app is a static export (`output: 'export'`) — there is no Node server in production. All privileged work
happens in Postgres (RLS, RPCs, triggers) or in Edge Functions (Google API, AI drafting), which is also why it
can be hosted on a static host without giving up security.

---

## Project layout

```
src/
  app/                 route segments (static export)
  components/
    ui/                design system: primitives, overlays, charts, table
    shell/             sidebar, topbar, command palette, route guard
    locations/         hours editor
  lib/
    domain/            pure logic: audit rules, review drafting, KPIs, hours, CSV, validation, permissions
    data/              store (Supabase + demo backends), demo dataset, AI drafting client
supabase/
  migrations/          schema, functions/views, RLS
  cron/                pg_cron schedule for the sync worker
  functions/           gbp-sync, gbp-oauth-callback, ai-draft
tests/
  unit/                Vitest
  e2e/                 Playwright
scripts/               db_tests.py, seed.ts
docs/                  product spec, architecture, ADRs, open-source review
```

---

## Security model

- RLS is enabled on **every** table. Reads are scoped by `is_member(org_id)`; writes additionally require a role.
- `is_member` / `has_role` are `security definer` functions with a pinned `search_path`, so policies cannot
  recurse and cannot be hijacked through a shadowed function.
- Google OAuth tokens live in `connection_secrets`, which has RLS enabled and **no policies at all** — only the
  service role (Edge Functions) can touch it. `anon` and `authenticated` have no grants on the table.
- The browser only ever holds the anon key. Every write is authorised by the database, not by the UI.
- Input validation is shared (Zod) and re-run server-side by Postgres constraints: PIN format, phone format,
  score ranges, unique review IDs, one organisation slug per workspace.
- The audit trail records who changed what; destructive actions require an owner or admin role.

---

## Known gaps

Honest list — see `docs/PRODUCT_SPEC.md` for the full roadmap:

- Google Business Profile API access is a **request-only** program. The OAuth flow, token storage and sync worker
  are implemented, but a new Google Cloud project must be approved for Business Profile API access before a real
  account can be connected.
- Rank tracking reads from `rank_snapshots`; the collector that fills it needs a SERP data provider
  (DataForSEO or SerpApi) wired into a scheduled function. The schema, grid rendering and summaries are done.
- Invitations are added by email to existing accounts; Kendra does not send the invitation email itself.
- Photo upload to Google is modelled in the bulk-job schema but not implemented in the worker.
