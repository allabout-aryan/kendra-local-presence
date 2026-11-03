'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, BadgeCheck, Building2, ClipboardList, MessageSquareText, ShieldCheck, Sparkles, TrendingUp,
} from 'lucide-react';
import { Badge, Button } from '@/components/ui/primitives';
import { useStore } from '@/lib/data/store';

const FEATURES = [
  {
    icon: Building2,
    title: 'Every outlet in one place',
    body: 'Pull all your Google Business Profiles into a single portfolio view. See hours, categories, photos and sync status per store — and spot the ones drifting out of date.',
  },
  {
    icon: ClipboardList,
    title: 'Bulk edits that actually land',
    body: 'Change festive hours, descriptions or attributes across forty outlets at once. Every job records what succeeded and what Google rejected, per store.',
  },
  {
    icon: MessageSquareText,
    title: 'A review inbox with a first draft',
    body: 'Negative reviews sorted by urgency, with a reply drafted from the specific complaint. Edit it, send it, and keep a record of who replied and when.',
  },
  {
    icon: ShieldCheck,
    title: 'An audit score you can defend',
    body: 'Thirteen deterministic rules score each profile out of 100 and tell you exactly which field costs you points — the same answer tomorrow, not a black box.',
  },
  {
    icon: TrendingUp,
    title: 'Local rank, per keyword',
    body: 'Track where each outlet appears for the searches that matter in its neighbourhood, with a grid view of rank by distance from the store.',
  },
  {
    icon: BadgeCheck,
    title: 'Built for brands, not single stores',
    body: 'Roles, seats, activity history and tenant isolation by row-level security. A brand manager sees everything; a store supervisor sees their patch.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { enterDemo, user } = useStore();

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-pine-600 text-[13px] font-bold text-white">K</span>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Kendra</span>
          </Link>
          <span className="ml-1 hidden rounded border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-ink-500 sm:inline">
            for multi-location brands
          </span>
          <nav className="ml-auto flex items-center gap-1">
            <Link href="#product" className="hidden px-2.5 py-1.5 text-[13px] text-ink-600 hover:text-ink-950 sm:block">
              Product
            </Link>
            <Link href="#how" className="hidden px-2.5 py-1.5 text-[13px] text-ink-600 hover:text-ink-950 sm:block">
              How it works
            </Link>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => router.push(user ? '/dashboard' : '/login')}
              className="ml-1"
            >
              {user ? 'Open workspace' : 'Sign in'}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                enterDemo();
                router.push('/dashboard');
              }}
              className="hidden sm:inline-flex"
            >
              Live demo
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="mx-auto max-w-6xl px-5 pb-10 pt-12 sm:pt-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <Badge tone="positive" dot>
                Built for dealers, franchises, clinics and showrooms
              </Badge>
              <h1 className="mt-4 max-w-[19ch] text-[34px] leading-[1.12] tracking-[-0.02em] text-ink-950 sm:text-[42px]">
                Every outlet, accurate, reviewed and ranking.
              </h1>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-ink-600">
                Brands with dozens of stores lose walk-ins to wrong hours, duplicate listings and unanswered
                reviews. Kendra keeps the whole portfolio clean from one screen — and tells you which fixes are
                worth the most.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={() => router.push('/login')}
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Open the workspace
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => {
                    enterDemo();
                    router.push('/dashboard');
                  }}
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Explore sample data
                </Button>
              </div>
              <p className="mt-3 text-[11px] text-ink-400">
                Live workspace backed by Supabase, seeded with a fictional 10-outlet coffee brand. Sign-in details are on the login screen.
              </p>
            </div>

            {/* product preview */}
            <div className="relative">
              <div className="card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-50/60 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-ink-300" />
                  <span className="h-2 w-2 rounded-full bg-ink-300" />
                  <span className="h-2 w-2 rounded-full bg-ink-300" />
                  <span className="ml-2 text-[10px] text-ink-400">kendra — portfolio overview</span>
                </div>
                <div className="grid grid-cols-3 gap-px bg-ink-100">
                  {[
                    { label: 'Outlets', value: '10' },
                    { label: 'Avg audit', value: '78' },
                    { label: 'Open reviews', value: '14' },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-white px-3 py-2.5">
                      <p className="label-caps">{stat.label}</p>
                      <p className="tabular mt-0.5 text-lg font-semibold text-ink-950">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-0 divide-y divide-ink-100">
                  {[
                    { name: 'Indiranagar', city: 'Bengaluru', score: 96, tone: 'text-pine-700 bg-pine-50' },
                    { name: 'Bandra West', city: 'Mumbai', score: 74, tone: 'text-amber-700 bg-amber-50' },
                    { name: 'Lower Parel', city: 'Mumbai', score: 48, tone: 'text-brick-700 bg-brick-50' },
                    { name: 'Jubilee Hills', city: 'Hyderabad', score: 92, tone: 'text-pine-700 bg-pine-50' },
                  ].map((row) => (
                    <div key={row.name} className="flex items-center gap-3 px-3 py-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-ink-100 text-[10px] font-semibold text-ink-600">
                        {row.name[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-ink-900">{row.name}</p>
                        <p className="text-[10px] text-ink-400">{row.city}</p>
                      </div>
                      <span className={`tabular rounded px-1.5 py-0.5 text-[11px] font-semibold ${row.tone}`}>{row.score}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-ink-200 bg-ink-50/60 px-3 py-2 text-[10px] text-ink-400">
                  Audit score = 100 − weighted findings across 13 rules
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* features */}
        <section id="product" className="border-y border-ink-200 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <p className="label-caps">What it does</p>
            <h2 className="mt-2 max-w-[30ch] text-[24px] leading-tight tracking-[-0.01em]">
              The unglamorous work that decides whether a store gets found.
            </h2>
            <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title}>
                  <feature.icon className="h-4.5 w-4.5 text-pine-600" aria-hidden />
                  <h3 className="mt-2.5 text-[13px] font-semibold text-ink-950">{feature.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-600">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* how it works */}
        <section id="how" className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="label-caps">How it works</p>
              <h2 className="mt-2 text-[24px] leading-tight tracking-[-0.01em]">Three steps to a clean portfolio.</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-600">
                Connect the Google account that owns your Business Profiles. Kendra reads every location, scores it,
                and queues the fixes that matter — you approve, it writes back.
              </p>
              <Button className="mt-5" variant="primary" onClick={() => router.push('/login')}>
                Open the workspace
              </Button>
            </div>
            <ol className="space-y-3">
              {[
                { step: '01', title: 'Connect', body: 'Authorise Google Business Profile once. Kendra pulls accounts, locations, reviews and 30 days of performance.' },
                { step: '02', title: 'Score and prioritise', body: 'Every profile is scored against 13 rules. The portfolio view ranks fixes by how many points they recover across how many outlets.' },
                { step: '03', title: 'Fix in bulk', body: 'Approve hours, descriptions, attributes or review replies. Each write is logged with a per-outlet result so nothing fails silently.' },
              ].map((item) => (
                <li key={item.step} className="card flex gap-4 p-4">
                  <span className="tabular text-[11px] font-semibold text-ink-300">{item.step}</span>
                  <div>
                    <h3 className="text-[13px] font-semibold text-ink-950">{item.title}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-5 py-6 sm:flex-row sm:items-center">
          <p className="text-[11px] text-ink-400">
            Kendra — a local presence manager for multi-location brands. Built on Next.js and Supabase.
          </p>
          <div className="flex items-center gap-4 text-[11px] text-ink-400">
            <Link href="/login" className="hover:text-ink-700">Sign in</Link>
            <Link href="/dashboard" className="hover:text-ink-700">Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
