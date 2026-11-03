'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Building2, MessageSquareText, ShieldAlert, TrendingUp } from 'lucide-react';
import { AppShell, PageGuard } from '@/components/shell/AppShell';
import { Badge, Button, Card, CardHeader, EmptyState, Progress, Skeleton } from '@/components/ui/primitives';
import { DiscoveryHeatmap, DistributionBars, ScoreTrend, Sparkline, TrendChart } from '@/components/ui/charts';
import { Td, Th, THead, Tr, TableWrap } from '@/components/ui/table';
import { useAuditResults, useStore } from '@/lib/data/store';
import { portfolioFixRanking } from '@/lib/domain/audit';
import { buildSeries, pctDelta, portfolioKpis, sum } from '@/lib/domain/kpis';
import { buildHeatmap } from '@/lib/domain/heatmap';
import { formatDuration, summariseSla } from '@/lib/domain/sla';
import { formatCompact, formatNumber, formatPercent, formatRelative } from '@/lib/domain/format';
import { cn } from '@/lib/utils';

function StatCard({
  label,
  value,
  hint,
  delta,
  spark,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  delta?: number | null;
  spark?: number[];
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between">
        <p className="label-caps">{label}</p>
        <span className="text-ink-300">{icon}</span>
      </div>
      <p className="tabular mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-ink-950">{value}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
          {delta !== null && delta !== undefined && (
            <span className={cn('tabular font-medium', delta >= 0 ? 'text-pine-700' : 'text-brick-600')}>
              {formatPercent(delta)}
            </span>
          )}
          {hint}
        </span>
        {spark && spark.length > 1 && <Sparkline values={spark} width={64} height={20} />}
      </div>
    </Card>
  );
}

function DashboardInner() {
  const { data, org, status, mode } = useStore();
  const audits = useAuditResults();
  const [range, setRange] = React.useState<30 | 14>(30);

  const health = React.useMemo(
    () =>
      audits.map(({ location, result }) => {
        const reviews = data.reviews.filter((review) => review.location_id === location.id);
        const rated = reviews.filter((review) => review.rating > 0);
        return {
          ...location,
          audit_score: result.score,
          open_reviews: reviews.filter((r) => r.status === 'new' || r.status === 'drafted' || r.status === 'escalated').length,
          negative_open: reviews.filter((r) => r.sentiment === 'negative' && r.status !== 'replied' && r.status !== 'ignored').length,
          total_reviews: reviews.length,
          avg_rating: rated.length ? rated.reduce((total, review) => total + review.rating, 0) / rated.length : 0,
          calls_30d: sum(data.metrics.filter((m) => m.location_id === location.id), (m) => m.calls),
          directions_30d: sum(data.metrics.filter((m) => m.location_id === location.id), (m) => m.direction_requests),
          views_30d: sum(data.metrics.filter((m) => m.location_id === location.id), (m) => m.views),
        };
      }),
    [audits, data.reviews, data.metrics],
  );

  const kpis = portfolioKpis(health);
  const series = React.useMemo(() => buildSeries(data.metrics, range), [data.metrics, range]);
  const half = Math.floor(series.length / 2);
  const viewsDelta = pctDelta(
    sum(series.slice(half), (p) => p.views),
    sum(series.slice(0, half), (p) => p.views),
  );
  const callsDelta = pctDelta(
    sum(series.slice(half), (p) => p.calls),
    sum(series.slice(0, half), (p) => p.calls),
  );

  const attention = [...health].sort((a, b) => a.audit_score - b.audit_score).slice(0, 5);
  const fixRanking = portfolioFixRanking(audits.map((entry) => entry.result)).slice(0, 5);
  const backlog = data.reviews
    .filter((review) => review.status === 'new' || review.status === 'drafted' || review.status === 'escalated')
    .sort((a, b) => a.rating - b.rating)
    .slice(0, 4);

  const heatmap = React.useMemo(() => buildHeatmap(data.metrics, 91, (snapshot) => snapshot.views), [data.metrics]);
  const sla = React.useMemo(() => summariseSla(data.reviews), [data.reviews]);
  const scoreTrend = React.useMemo(() => {
    const byDate = new Map<string, { total: number; count: number }>();
    for (const snapshot of data.auditSnapshots) {
      const entry = byDate.get(snapshot.captured_on) ?? { total: 0, count: 0 };
      entry.total += snapshot.score;
      entry.count += 1;
      byDate.set(snapshot.captured_on, entry);
    }
    return [...byDate.entries()]
      .map(([captured_on, entry]) => ({ captured_on, avg_score: Math.round((entry.total / entry.count) * 10) / 10 }))
      .sort((a, b) => a.captured_on.localeCompare(b.captured_on));
  }, [data.auditSnapshots]);
  const scoreDelta = scoreTrend.length > 1
    ? scoreTrend[scoreTrend.length - 1].avg_score - scoreTrend[0].avg_score
    : null;

  const bandCounts = {
    healthy: health.filter((h) => h.audit_score >= 85).length,
    attention: health.filter((h) => h.audit_score >= 65 && h.audit_score < 85).length,
    critical: health.filter((h) => h.audit_score < 65).length,
  };

  if (status === 'loading') {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[104px]" />
        ))}
      </div>
    );
  }

  return (
    <AppShell
      title="Portfolio overview"
      subtitle={`${org?.name ?? 'Workspace'} · ${kpis.locations} outlets · last synced ${formatRelative(data.connection?.last_synced_at ?? null)}`}
      actions={
        <Button size="sm" variant="primary" onClick={() => (window.location.href = '/reviews')} className="hidden sm:inline-flex">
          Review inbox
        </Button>
      }
    >
      {kpis.locations === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-4.5 w-4.5" />}
            title="No outlets yet"
            description="Add your first outlet to start scoring profiles and collecting reviews."
            action={
              <Button variant="primary" onClick={() => (window.location.href = '/locations')}>
                Add an outlet
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Outlets"
              value={String(kpis.locations)}
              hint={`${kpis.activeLocations} active`}
              icon={<Building2 className="h-4 w-4" />}
            />
            <StatCard
              label="Avg audit score"
              value={kpis.avgAudit.toFixed(0)}
              hint={kpis.atRisk > 0 ? `${kpis.atRisk} below 65` : 'all above 65'}
              icon={<ShieldAlert className="h-4 w-4" />}
            />
            <StatCard
              label="Open reviews"
              value={String(kpis.openReviews)}
              hint={kpis.negativeOpen > 0 ? `${kpis.negativeOpen} negative` : 'none negative'}
              icon={<MessageSquareText className="h-4 w-4" />}
            />
            <StatCard
              label="Calls · 30d"
              value={formatCompact(kpis.calls30d)}
              hint={`${formatCompact(kpis.directions30d)} directions`}
              delta={callsDelta}
              spark={series.map((point) => point.calls)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <Card>
              <CardHeader
                title="Discovery over time"
                description="Views, calls and direction requests across the portfolio"
                action={
                  <div className="flex items-center gap-1 rounded-lg border border-ink-200 p-0.5">
                    {([14, 30] as const).map((value) => (
                      <button
                        key={value}
                        onClick={() => setRange(value)}
                        className={cn(
                          'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                          range === value ? 'bg-ink-950 text-white' : 'text-ink-500 hover:text-ink-900',
                        )}
                      >
                        {value}d
                      </button>
                    ))}
                  </div>
                }
              />
              <div className="px-2 pb-2 pt-3">
                <TrendChart
                  dates={series.map((point) => point.date)}
                  series={[
                    { label: 'Views', colour: '#0E5B46', values: series.map((p) => p.views) },
                    { label: 'Calls', colour: '#1E5AA8', values: series.map((p) => p.calls) },
                    { label: 'Directions', colour: '#9A5B00', values: series.map((p) => p.directions) },
                  ]}
                  valueFormatter={(value) => formatCompact(value)}
                />
                <div className="flex items-center justify-between border-t border-ink-100 px-3 pt-2.5 text-[11px] text-ink-500">
                  <span>
                    Views <span className="tabular font-medium text-ink-900">{formatNumber(sum(series, (p) => p.views))}</span>
                    {viewsDelta !== null && (
                      <span className={cn('ml-1.5 tabular font-medium', viewsDelta >= 0 ? 'text-pine-700' : 'text-brick-600')}>
                        {formatPercent(viewsDelta)}
                      </span>
                    )}
                  </span>
                  <span>
                    Directions <span className="tabular font-medium text-ink-900">{formatNumber(sum(series, (p) => p.directions))}</span>
                  </span>
                </div>
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader title="Profile health" description="Outlets by audit band" />
                <div className="space-y-3 p-4">
                  <DistributionBars
                    total={kpis.locations}
                    segments={[
                      { label: 'Healthy', value: bandCounts.healthy, colour: '#0E5B46' },
                      { label: 'Needs work', value: bandCounts.attention, colour: '#9A5B00' },
                      { label: 'Critical', value: bandCounts.critical, colour: '#B42318' },
                    ]}
                  />
                  <div className="flex items-baseline gap-2 border-t border-ink-100 pt-3">
                    <span className="tabular text-[26px] font-semibold leading-none text-ink-950">{kpis.avgRating.toFixed(2)}</span>
                    <span className="text-[11px] text-ink-500">average rating across rated outlets</span>
                  </div>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Biggest wins available"
                  description="Points recoverable across the portfolio"
                  action={
                    <Link href="/audit" className="text-[11px] font-medium text-pine-700 hover:underline">
                      Audit
                    </Link>
                  }
                />
                <ul className="divide-y divide-ink-100">
                  {fixRanking.length === 0 && <li className="px-4 py-6 text-center text-[12px] text-ink-500">Nothing outstanding.</li>}
                  {fixRanking.map((fix) => (
                    <li key={fix.rule_key} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-ink-900">{fix.title}</p>
                        <p className="text-[10px] text-ink-400">{fix.locations} outlet{fix.locations > 1 ? 's' : ''}</p>
                      </div>
                      <span className="tabular rounded bg-pine-50 px-1.5 py-0.5 text-[11px] font-semibold text-pine-700">
                        +{fix.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
            <Card>
              <CardHeader
                title="Discovery rhythm"
                description="Daily profile views, last 13 weeks"
                action={<span className="tabular text-[11px] text-ink-400">{formatCompact(heatmap.total)} views</span>}
              />
              <div className="p-3">
                <DiscoveryHeatmap weeks={heatmap.weeks} levels={heatmap.levels} />
              </div>
            </Card>

            <Card>
              <CardHeader title="Audit score trend" description="Portfolio average, last 30 days" />
              <div className="px-2 pb-2 pt-3">
                <ScoreTrend points={scoreTrend} />
                <div className="flex items-baseline justify-between border-t border-ink-100 px-2 pt-2 text-[11px] text-ink-500">
                  <span>
                    Today{' '}
                    <span className="tabular font-semibold text-ink-900">
                      {scoreTrend.length ? scoreTrend[scoreTrend.length - 1].avg_score.toFixed(1) : '—'}
                    </span>
                  </span>
                  {scoreDelta !== null && (
                    <span className={scoreDelta >= 0 ? 'text-pine-700' : 'text-brick-600'}>
                      {scoreDelta >= 0 ? '+' : ''}{scoreDelta.toFixed(1)} over 30 days
                    </span>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Needs attention"
                description="Lowest audit scores first"
                action={
                  <Link href="/locations" className="text-[11px] font-medium text-pine-700 hover:underline">
                    All outlets
                  </Link>
                }
              />
              <TableWrap className="max-h-[320px] overflow-y-auto">
                <THead>
                  <Th>Outlet</Th>
                  <Th align="right">Score</Th>
                  <Th>Top fix</Th>
                </THead>
                <tbody>
                  {attention.map((row) => {
                    const entry = audits.find((a) => a.location.id === row.id);
                    return (
                      <Tr key={row.id}>
                        <Td>
                          <Link href={`/locations?outlet=${row.id}`} className="block hover:underline">
                            <span className="block text-[13px] font-medium text-ink-900">{row.name}</span>
                            <span className="text-[11px] text-ink-400">{row.city}</span>
                          </Link>
                        </Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress
                              value={row.audit_score}
                              tone={row.audit_score >= 85 ? 'accent' : row.audit_score >= 65 ? 'warning' : 'danger'}
                              className="w-14"
                            />
                            <span className="tabular w-6 text-right text-[12px] font-semibold text-ink-900">{row.audit_score}</span>
                          </div>
                        </Td>
                        <Td>
                          <span className="line-clamp-1 text-[11px] text-ink-500">{entry?.result.topFix?.title ?? '—'}</span>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </Card>

            <Card>
              <CardHeader
                title="Review backlog"
                description="Lowest ratings first"
                action={
                  <Link href="/reviews" className="flex items-center gap-0.5 text-[11px] font-medium text-pine-700 hover:underline">
                    Open inbox <ArrowUpRight className="h-3 w-3" />
                  </Link>
                }
              />
              {backlog.length === 0 ? (
                <EmptyState title="Inbox is clear" description="Every review has a reply or has been closed." />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {backlog.map((review) => (
                    <li key={review.id} className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'tabular rounded px-1.5 py-0.5 text-[10px] font-semibold',
                            review.rating <= 2 ? 'bg-brick-50 text-brick-700' : review.rating === 3 ? 'bg-amber-50 text-amber-700' : 'bg-pine-50 text-pine-700',
                          )}
                        >
                          {review.rating}★
                        </span>
                        <span className="truncate text-[12px] font-medium text-ink-900">{review.author_name}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-ink-400">{formatRelative(review.published_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-600">{review.comment}</p>
                      <p className="mt-1 text-[10px] text-ink-400">{review.location_name}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center justify-between border-t border-ink-200 px-4 py-2 text-[11px] text-ink-500">
                <span>Median first reply {formatDuration(sla.medianHours)}</span>
                <span className={sla.overdue > 0 ? 'text-brick-600' : 'text-pine-700'}>
                  {sla.overdue > 0 ? `${sla.overdue} overdue` : 'within SLA'}
                </span>
              </div>
            </Card>
          </div>

          {mode === 'demo' && (
            <p className="text-center text-[11px] text-ink-400">
              Demo workspace — {data.locations.length} sample outlets, {data.reviews.length} sample reviews. Every number on this page is computed live from that data.
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <PageGuard>
      <DashboardInner />
    </PageGuard>
  );
}
