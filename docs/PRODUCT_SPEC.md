# Kendra — product specification

## 1. Product definition

**One line.** Kendra is the control room for a multi-location brand's presence on Google: every outlet, its
accuracy, its reviews and its local rank, with the next fix ranked by what it is worth.

**Target user.** The marketing or retail-ops lead at a brand running 10–500 outlets — dealers, franchises,
clinics, showrooms, restaurant chains. They are accountable for walk-ins and calls per store, they do not have a
local-SEO team, and they currently run this off a spreadsheet plus whoever remembers the Google password.

**Buyer and pricing.** Sold to the brand's marketing head. Priced per outlet per month (₹499 / ₹999 / ₹1,499
across Growth / Scale / Enterprise), because that is how the value accrues and how the customer's own budget is
structured. Seats are included; outlets are the metered unit.

## 2. Core problem

A chain's Google presence decays quietly:

- Hours are wrong on the day of a festival and nobody notices for a week — walk-ins are lost silently.
- Duplicate or half-filled profiles split ranking signals between two listings of the same store.
- Negative reviews sit unanswered for weeks, in public, on the page that high-intent customers read last.
- Head office has no per-outlet view, so it cannot tell a good store from a well-reviewed one.

The cost is invisible in aggregate and obvious per store. That asymmetry is the product's reason to exist.

## 3. Main use cases

1. **Weekly portfolio triage.** "Which five outlets need attention this week, and what exactly is wrong?"
2. **Bulk correction.** "Set festive hours on all 34 outlets, keep the weekly-off days closed."
3. **Review response.** "Clear the negative backlog with replies that are specific and safe to publish."
4. **Reporting upward.** "Prove the walk-in impact of the work with a per-outlet report, exported."
5. **Onboarding a new outlet or a new city.** "Get a store from unlisted to complete in one sitting."

## 4. Primary journey

```
Sign up → create workspace → connect Google Business Profile
        → outlets sync → audit scores computed
        → dashboard surfaces the five worst outlets
        → open outlet → see findings → fix (single or bulk)
        → reviews inbox → draft → edit → post
        → weekly report → export
```

Every step above exists in the app. The only step that needs external approval is the Google connection.

## 5. Key workflows

**Audit.** Thirteen rules, fixed weights, one score per outlet (0–100). Deterministic by design: a brand manager
must get the same answer tomorrow, and must be able to argue with a specific rule rather than with a model.
Findings carry a point value so the portfolio view can rank fixes by *recoverable points × affected outlets*.

**Bulk edit.** Select outlets → choose an operation (hours, description, attributes, re-sync) → configure →
run. The job records total, succeeded, failed and a per-outlet error. Hours patches can preserve closed days, so
a chain with a weekly off does not get accidentally opened on Mondays.

**Review reply.** The inbox sorts lowest rating first. A draft is generated either by the configured model
(through an Edge Function, key server-side) or by the deterministic template generator, and the UI always says
which. Before posting, the draft is checked for length and for promises a brand should not make publicly
(refunds, guarantees, absolute claims).

**Reporting.** Discovery metrics (views, searches, calls, directions, website clicks) with period-over-period
deltas; rank by keyword with a 5×5 grid showing position by distance from the store.

## 6. MVP (shipped)

- Email/password and magic-link auth, workspace bootstrap, four roles, seat limits
- Locations CRUD with validation, drawer, audit findings, CSV export
- Bulk edit with job history and per-outlet results
- Review inbox with drafting, safety checks, reply persistence
- Dashboard KPIs and trend, audit page with portfolio fix ranking
- Reports with per-outlet table, rank summary, rank grid, CSV export
- Settings, team management, activity log
- Demo workspace so the product is evaluable without credentials

## 7. Advanced (post-MVP)

- Scheduled rank collection with a SERP provider, history and movement alerts
- Photo upload and post scheduling to Google, with approval workflows
- Duplicate-listing detection and merge requests via the API
- Per-outlet and per-region targets with alerts when a store regresses
- Client-facing white-label reports for agencies (PDF, branded)
- WhatsApp nudges to store managers when their outlet drops below a score

## 8. Admin functionality

- Organisation settings (name, colour, plan), owner/admin only
- Member add/remove via security-definer RPCs with seat enforcement
- Connection management (connect, re-sync, error state)
- Activity log as the audit trail; every write is attributable

## 9. Data model

`profiles`, `organizations`, `memberships`, `locations`, `reviews`, `bulk_jobs`, `bulk_job_items`,
`metric_snapshots`, `rank_snapshots`, `audit_findings`, `activity_events`, `connections`, `connection_secrets`.

Enums for role, location status, review status and sentiment, job kind and status, severity. Every table is
org-scoped with a foreign key to `organizations`, and every org-scoped table carries RLS.

## 10. External integrations

| Integration | Purpose | Status |
| --- | --- | --- |
| Google Business Profile API | locations, hours, attributes, reviews, performance | OAuth + sync worker implemented; access is a request-only Google program |
| AI provider (OpenAI-compatible / Sarvam) | review reply drafting | Adapter implemented in an Edge Function; falls back to templates |
| SERP provider (DataForSEO / SerpApi) | rank snapshots | Schema and UI done; collector pending |
| Supabase | auth, database, RLS, functions, cron | Live |

## 11. Security requirements

- Tenant isolation enforced by the database, never by the UI.
- No service-role key or provider secret in the browser bundle.
- OAuth tokens in a table with RLS enabled and no policies.
- Validated input at the edge and constraints in the schema (defence in depth).
- Destructive operations restricted by role and recorded.
- Explicit tests for cross-tenant access, privilege escalation and secret access.

## 12. Success metrics

- Time to first insight after signup: under 5 minutes from connection.
- Share of outlets scoring ≥ 85 within 60 days of onboarding.
- Median first-response time to a negative review: under 24 hours.
- Weekly active seats per workspace: ≥ 2 (the product is a team tool, not a personal one).
- Net revenue retention per outlet: the churn signal that matters for a per-location price.

## 13. Non-goals

- Not a general SEO tool: no content briefs, no backlink analysis, no web crawling.
- Not a CRM: leads and reviews are surfaced, not pipelined.
- Not a social scheduler beyond Google posts.
- No AI-generated review *solicitation* — that is a trust problem, not a feature.
