# Architecture decision records

Short, dated records of the choices that shaped the build. Each lists what was decided, what it costs, and what
was rejected.

---

## ADR-001 — Static SPA on Supabase instead of a Node API

**Context.** The product is a signed-in dashboard, and the deployment targets are GitHub Pages and Netlify.
GitHub Pages serves static files only.

**Decision.** Ship `output: 'export'`. All authorisation lives in Postgres RLS; all privileged work lives in
Edge Functions. No application server.

**Consequences.** No SSR (acceptable — no SEO surface behind a login), skeleton-then-content first paint, and the
security model depends on RLS being correct. That last point is why the database test suite attacks the policies
directly rather than trusting them.

**Rejected.** A Next.js server on Vercel/Netlify Functions: more moving parts, and it would not deploy to Pages.

---

## ADR-002 — Hand-built design system over a component library

**Context.** The brief explicitly asks to avoid the generic AI-generated SaaS look.

**Decision.** ~1,000 lines of primitives, overlays, charts and table in `src/components/ui`, on Tailwind with a
small custom palette (warm paper, ink greys, one pine accent, amber and brick for state).

**Consequences.** Full control of typography, spacing and state design; no runtime CSS-in-JS; a smaller bundle.
Cost: we own accessibility details (focus rings, ARIA on tabs/switches/dialogs) and any new component.

**Rejected.** shadcn/ui — good, but its default theming is now recognisable everywhere, and it would have pulled
in Radix primitives for a component set this small. Mantine/MUI — too heavy, too opinionated.

---

## ADR-003 — Deterministic audit rules, not a model

**Context.** The audit score is the product's core promise and the thing a brand manager will argue about.

**Decision.** Thirteen weighted rules in pure TypeScript. Same input, same score, forever. Findings carry a point
value so fixes can be ranked by recoverable points × affected outlets.

**Consequences.** Explainable and testable (every rule has unit tests). It cannot learn that "clinic" profiles
need different fields than "showroom" ones — that would be a rule set per category, not a model.

**Rejected.** An LLM scoring pass: unexplainable, non-deterministic, and it would make the score impossible to
defend in a client review.

---

## ADR-004 — AI drafting with a deterministic fallback, and visible provenance

**Context.** Reply drafting is the highest-value AI feature here, and the highest-risk one: a wrong public reply
is a brand problem.

**Decision.** An Edge Function calls the provider (OpenAI-compatible or Sarvam) with the model key server-side. If
no provider is configured or the call fails, a template generator produces the draft. The UI states which
produced the text, and a safety check blocks refund promises and absolute claims before posting.

**Consequences.** The feature works with zero configuration and degrades visibly rather than silently. A human
still approves every reply.

**Rejected.** Calling the provider from the browser with a public key; and shipping only the AI path, which would
make the product broken until a key is supplied.

---

## ADR-005 — One store with two backends

**Context.** The product must be demonstrable on a public URL without a Supabase project, without shipping mocks
into the real code path.

**Decision.** A single store interface with a Supabase implementation and a demo implementation seeded from a
deterministic PRNG. The demo is labelled in the UI, persisted to `localStorage`, and uses the same domain logic.

**Consequences.** The deployed demo is a real product experience, not screenshots. The risk is demo-only
divergence; it is contained because both backends return the same `WorkspaceData` shape and the audit/KPI logic
is shared.

**Rejected.** Shipping only live mode (the public URL would be an empty login screen) and shipping fake fixtures
inside components (which is the thing the brief forbids).

---

## ADR-006 — Bulk edits run in the request path

**Context.** Bulk operations across hundreds of outlets are the natural place to reach for a queue.

**Decision.** Run them inline, writing `bulk_jobs` and one `bulk_job_items` row per outlet.

**Consequences.** The user sees per-outlet results immediately, which is the actual requirement. At a few hundred
outlets with a handful of writes each this is fine. The schema already supports a worker (`status`, `started_at`,
`finished_at`, per-item status), so moving it later is a code change, not a migration.

**Rejected.** pgmq / a worker from day one — infrastructure for a scale the product does not yet have.

---

## ADR-007 — Python + psycopg for schema tests instead of pgTAP

**Context.** RLS bugs are the unacceptable class of bug here, so the policies need real tests. pgTAP is the
Supabase-idiomatic answer.

**Decision.** A Python harness boots embedded PostgreSQL, applies the migrations, then runs each assertion as
`set local role authenticated` with a forged JWT subject — exactly what PostgREST does — and rolls back.

**Consequences.** No extension required, readable failure output, and tests that assert on *denial* (zero rows or
a privilege error) rather than on internals. Cost: a Python dependency in the test path, documented in the README.

**Rejected.** pgTAP: one more extension to manage, and its assertion style hides the fact that RLS denial can
manifest as an error rather than an empty set.

---

## ADR-008 — Hand-rolled SVG charts

**Context.** Recharts and Chart.js are the default choices and would each add 40–90 kB.

**Decision.** A `sparklinePath` / `areaPath` pair of pure functions plus a small `TrendChart` with hover.

**Consequences.** ~4 kB instead of a charting library, and the path maths is unit-tested (axis inversion, flat
series on the midline, single-point centring). Cost: no tooltips with rich formatting, no zoom — not needed here.

---

## ADR-009 — Reports and exports are CSV, not PDF

**Context.** Agencies ask for branded PDFs; the brief asks for real functionality over decoration.

**Decision.** CSV exports everywhere (outlets, audit findings, performance), with formula-injection guarding.

**Consequences.** Every export opens in Excel or Sheets, which is what an ops team actually does with it. Branded
PDF reports are on the roadmap as an explicit future feature rather than a half-built button.
