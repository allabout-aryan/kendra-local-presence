# Open-source building blocks

Selection criteria, in order: actively maintained, credible community, good documentation, a commercially usable
licence (MIT / Apache-2.0 / ISC / BSD), production-proven, easy to self-host, free, and compatible with the chosen
stack. For each entry below the question asked was *"is this genuinely better than building it ourselves?"* — not
*"is this popular?"*

## Chosen

| Project | Licence | Why it earned its place |
| --- | --- | --- |
| **Next.js** (`vercel/next.js`) | MIT | App Router, file-based routing, static export with per-route splitting. The export mode is what makes the GitHub Pages target possible at all. |
| **React** | MIT | Required by Next.js; 19's concurrent rendering keeps the dashboard's heavy tables responsive. |
| **TypeScript** | Apache-2.0 | Strict mode throughout. The store's `WorkspaceData` contract is what keeps the two backends honest. |
| **Tailwind CSS** | MIT | Utility CSS with no runtime. Paired with a custom token set in `tailwind.config.ts` rather than default theming. |
| **Supabase** (`supabase/supabase`) | Apache-2.0 | Postgres + Auth + RLS + Edge Functions + cron in one managed surface. RLS is the reason a static SPA can be secure. |
| **supabase-js** | MIT | Typed-ish client for PostgREST, Auth and Functions. Small, and it is the official path. |
| **Zod** (`colinhacks/zod`) | MIT | One schema per input, shared by the form and the data layer. Errors are field-addressable, which is what makes the forms feel finished. |
| **date-fns** | MIT | Tree-shakeable date maths for relative timestamps and 30-day windows. |
| **lucide** (`lucide-icons/lucide`) | ISC | Consistent 16px icon set, tree-shaken, no icon font. |
| **clsx** + **tailwind-merge** | MIT | Conditional classes without the merge conflicts that Tailwind utility composition causes. |
| **Vitest** (`vitest-dev/vitest`) | MIT | Fast, native ESM/TS, same config surface as Vite. The 91 unit tests run in ~0.2 s of test time. |
| **Playwright** (`microsoft/playwright`) | Apache-2.0 | Real browser E2E across desktop and a Pixel viewport, with trace on failure. |
| **pgserver** + **psycopg** | MIT / LGPL-3.0 | Embedded PostgreSQL for the RLS test suite, so the schema is verified without a hosted project. |
| **Google Business Profile API** | Google ToS | The only legitimate source of location, review and performance data. Request-only access. |

## Evaluated and deliberately not used

| Candidate | Why not |
| --- | --- |
| **shadcn/ui** (`shadcn-ui/ui`) | Excellent, and the default answer for a Next.js product. Rejected because its default look is now ubiquitous — the brief asks specifically for something that does not read as an AI-generated SaaS dashboard. Owning ~1,000 lines of primitives was cheaper than restyling a library. |
| **Radix UI primitives** (`radix-ui/primitives`) | Would have solved dialog/popover focus management. Rejected: three overlays and one menu did not justify the dependency, and the accessibility requirements here (focus trap, escape, ARIA roles) are small enough to implement and read. |
| **TanStack Query** (`TanStack/query`) | The right tool for a fetch-heavy SPA with many independent endpoints. Here there is one store, one load per org, and mutations that already refetch — a cache layer would add concepts without removing work. |
| **TanStack Table** (`TanStack/table`) | Server-side pagination and a handful of sortable columns did not justify a headless table engine; a 40-line `Th`/`Td`/`Pagination` set covers it. |
| **Recharts** (`recharts/recharts`) | 40–90 kB for two chart shapes. Replaced with a pure path-builder and a small SVG component, both unit-tested. |
| **React Hook Form** | Zod plus controlled inputs was enough for the form count here; RHF's value shows up at 20+ field forms. |
| **Prisma / Drizzle** | Supabase's generated client plus SQL migrations keeps one source of truth. An ORM would have hidden the RLS behaviour, which is the part that most needs to be explicit. |
| **pgTAP** | See ADR-007 — the Python harness tests denial directly. |
| **pgmq / Trigger.dev / Inngest** | Real queueing for bulk jobs was premature at this scale; the schema supports adding it later. |
| **Birdeye / Yext / Uberall** | Commercial incumbents. Useful as a feature benchmark (review inbox, listings sync, reporting) and as evidence of the pricing gap in India — not as dependencies. |
| **Local Falcon / Places Scout** | Rank-grid competitors. Confirmed the grid visualisation is table stakes; the collector needs a SERP data provider rather than a full product. |

## Dependency discipline

- Production dependencies: **10**. Everything else is dev-only.
- No CSS-in-JS runtime, no icon font, no charting library, no state-management library, no UI kit.
- Shared JS for the whole app: **~105 kB**.
- Every dependency above is either the framework, the backend SDK, or a validation/formatting utility — the three
  categories where writing it yourself is a worse use of time.
