# Testing

Four layers, each testing something the others cannot.

| Layer | Command | What it proves | Last run |
| --- | --- | --- | --- |
| Type safety | `pnpm typecheck` | The whole app compiles under `strict`, no `any` leaks | pass |
| Lint | `pnpm lint` | No ESLint warnings or errors (`next/core-web-vitals`) | pass |
| Unit + render | `pnpm test` | 102 assertions over domain logic, the data layer and two real page renders (jsdom) | 102/102 |
| Database + RLS | `pnpm test:db` | Schema, constraints, policies, RPCs, views, cascades | 31/31 |
| Build | `pnpm build` | Static export of 15 routes, ~105 kB shared JS | pass |
| HTTP smoke | `python3 scripts/smoke_static.py` | Every exported route and its assets resolve over HTTP | 12/12 |
| E2E | `pnpm test:e2e` | Real browser journey (needs `playwright install chromium`) | not run here |

## Unit and render tests (Vitest) — 102 assertions

- **audit** — a complete outlet scores 100 with no findings; each rule's penalty; missing-hours names the days;
  no-photo and stale-photo rules never double-count; negative backlog becomes the top fix; scores clamp to 0–100;
  band thresholds at 85/65; portfolio fix ranking aggregates points × outlets.
- **hours** — normalisation drops unknown days and malformed times; missing-day detection; grouping
  (`Mon–Fri 8am–10pm · Sat–Sun 9am–11pm`); closed vs unknown; weekly totals; patch semantics that preserve a
  weekly-off day; 24-hour validation.
- **reviews** — sentiment from rating plus signal words; a 4★ review carrying a complaint is neutral, not
  positive; issue detection across eight categories; drafts name the reviewer and outlet, never promise refunds,
  and stay inside the character budget for every rating; the safety check blocks refund promises, absolute
  claims and stub replies.
- **kpis** — sums ignore non-finite values; percentage change returns null rather than infinity with no
  baseline; series are dense and zero-filled; sparkline paths invert the y-axis, centre a single point and draw a
  flat series on the midline; rank averages exclude "not found"; movement direction; portfolio rollups and the
  at-risk count.
- **csv** — quoting for commas, quotes and newlines; nulls; spreadsheet formula-injection guarding.
- **format** — lakh/crore compaction, Indian digit grouping, ₹ currency, signed percentages, relative time,
  initials.
- **permissions** — the role × action matrix, including that a viewer can export but never write.
- **validation** — Indian PIN and phone formats, URL scheme requirement, bulk-edit superRefine rules (hours
  required, closing after opening, description/attributes required), reply length bounds, invite and settings.
- **dataset** — the demo workspace is treated as real data: referential integrity, one metric row per outlet per
  day, full 5×5 rank grids, **stored audit scores equal the scores the UI recomputes**, determinism across
  builds, and at least one outlet in each audit band.

### Client render tests (jsdom) — 2

- **dashboard** mounts inside the real providers, waits for the store to load the demo dataset, and asserts the
  computed KPI cards, the biggest-wins ranking, the attention table, the demo-mode banner and that an outlet from
  the dataset is actually rendered.
- **reviews** mounts the inbox and asserts real review rows with working reply buttons.

These exist because a static export is prerendered as a loading shell — the build passing does not prove the
client renders. This does.

## Database tests (Python + psycopg + embedded Postgres) — 31 assertions

Boots PostgreSQL, applies the three migrations in order, seeds two tenants, then attacks the policies by
switching into the `authenticated` role with a forged JWT subject — exactly what PostgREST does — and rolling
back after each assertion.

Covered: cross-tenant reads and writes denied; anon reads nothing; member can read/create/update but not delete;
member cannot escalate their own role or add members; viewer read-only; owner can delete and update settings;
`connection_secrets` unreadable by any authenticated user while the service role still sees it; profiles visible
only within a tenant; signup trigger creates a profile; `create_organization` bootstraps owner membership and
rejects anon; `add_member_by_email` authorises and enforces seats; an owner cannot be removed; duplicate reviews
and out-of-range ratings rejected; audit-score and slug constraints enforced; `v_location_health` aggregates and
still respects RLS; `v_portfolio_rollup` aggregates; deleting an org cascades to its locations.

## Not run in this environment

- **Playwright E2E** — the sandbox has no browser binaries and cannot download them. The spec
  (`tests/e2e/smoke.spec.ts`) covers the landing → demo → dashboard journey, drafting and posting a review
  reply, a bulk edit run, the unauthenticated redirect, and a 390 px viewport. Run it with
  `pnpm build && npx serve out -p 3000` then `E2E_BASE_URL=http://localhost:3000 pnpm test:e2e`.
- **Live Supabase integration** — the connected Supabase projects are paused, so migrations were verified against
  a local PostgreSQL that mimics Supabase's roles (`anon`, `authenticated`, `service_role`) and `auth.uid()`.
