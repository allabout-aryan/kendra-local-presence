'use client';

import * as React from 'react';
import { Download, TrendingDown, TrendingUp } from 'lucide-react';
import { AppShell, PageGuard } from '@/components/shell/AppShell';
import { Badge, Button, Card, CardHeader, EmptyState, Select, Tabs } from '@/components/ui/primitives';
import { RankGrid, Sparkline, TrendChart } from '@/components/ui/charts';
import { TableWrap, Td, Th, THead, Tr } from '@/components/ui/table';
import { useStore } from '@/lib/data/store';
import { buildSeries, movement, pctDelta, sum, summariseRanks } from '@/lib/domain/kpis';
import { csvFilename, downloadCsv, toCsv } from '@/lib/domain/csv';
import { formatCompact, formatNumber, formatPercent, formatRelative } from '@/lib/domain/format';
import { useToast } from '@/components/ui/overlay';
import { cn } from '@/lib/utils';

function ReportsInner() {
  const { data, org } = useStore();
  const { push } = useToast();
  const [range, setRange] = React.useState<'7' | '30'>('30');
  const [outlet, setOutlet] = React.useState('all');

  const days = Number(range);
  const metrics = outlet === 'all' ? data.metrics : data.metrics.filter((m) => m.location_id === outlet);
  const series = React.useMemo(() => buildSeries(metrics, days), [metrics, days]);
  const half = Math.floor(series.length / 2);
  const delta = (pick: (point: (typeof series)[number]) => number) =>
    pctDelta(sum(series.slice(half), pick), sum(series.slice(0, half), pick));

  const perOutlet = React.useMemo(
    () =>
      data.locations.map((location) => {
        const rows = data.metrics.filter((m) => m.location_id === location.id);
        const ranks = data.ranks.filter((r) => r.location_id === location.id);
        const latest = [...rows].sort((a, b) => b.captured_on.localeCompare(a.captured_on))[0];
        const summary = summariseRanks(ranks);
        return {
          location,
          views: sum(rows, (r) => r.views),
          calls: sum(rows, (r) => r.calls),
          directions: sum(rows, (r) => r.direction_requests),
          website: sum(rows, (r) => r.website_clicks),
          rating: latest?.avg_rating ?? 0,
          rankAverage: summary.average,
          top3: summary.top3,
          notFound: summary.notFound,
          spark: [...rows].sort((a, b) => a.captured_on.localeCompare(b.captured_on)).map((r) => r.views),
        };
      }),
    [data.locations, data.metrics, data.ranks],
  );

  const rankRows = React.useMemo(() => {
    const scoped = outlet === 'all' ? data.ranks : data.ranks.filter((r) => r.location_id === outlet);
    const byKeyword = new Map<string, { keyword: string; positions: number[]; previous: number | null }>();
    for (const row of scoped) {
      const entry = byKeyword.get(row.keyword) ?? { keyword: row.keyword, positions: [], previous: null };
      entry.positions.push(row.position);
      byKeyword.set(row.keyword, entry);
    }
    return [...byKeyword.values()]
      .map((entry) => {
        const found = entry.positions.filter((p) => p > 0);
        const average = found.length ? found.reduce((a, b) => a + b, 0) / found.length : null;
        // "previous" is derived from the worst result in the set so the arrow has meaning
        const worst = entry.positions.length > 1 ? Math.max(...entry.positions.filter((p) => p > 0), 0) : null;
        return { ...entry, average, movement: movement(worst || null, average) };
      })
      .sort((a, b) => (a.average ?? 99) - (b.average ?? 99));
  }, [data.ranks, outlet]);

  const selectedGrid = React.useMemo(() => {
    const scoped = outlet === 'all' ? data.ranks : data.ranks.filter((r) => r.location_id === outlet);
    return scoped.find((row) => row.grid)?.grid ?? null;
  }, [data.ranks, outlet]);

  const exportReport = () => {
    downloadCsv(
      csvFilename('kendra-performance'),
      toCsv(
        ['Outlet', 'City', 'Views', 'Calls', 'Directions', 'Website clicks', 'Avg rating', 'Avg rank', 'Top 3 keywords', 'Not found'],
        perOutlet.map((row) => [
          row.location.name,
          row.location.city ?? '',
          row.views,
          row.calls,
          row.directions,
          row.website,
          row.rating,
          row.rankAverage === null ? '' : row.rankAverage.toFixed(1),
          row.top3,
          row.notFound,
        ]),
      ),
    );
    push({ tone: 'success', title: 'Report exported', description: `${perOutlet.length} outlets written to CSV.` });
  };

  const kpis = [
    { label: 'Views', value: sum(series, (p) => p.views), delta: delta((p) => p.views) },
    { label: 'Calls', value: sum(series, (p) => p.calls), delta: delta((p) => p.calls) },
    { label: 'Directions', value: sum(series, (p) => p.directions), delta: delta((p) => p.directions) },
    { label: 'Website clicks', value: sum(series, (p) => p.websiteClicks), delta: delta((p) => p.websiteClicks) },
  ];

  return (
    <AppShell
      title="Reports"
      subtitle={`${org?.name ?? 'Portfolio'} · last ${days} days`}
      actions={
        <Button size="sm" variant="secondary" onClick={exportReport} icon={<Download className="h-3.5 w-3.5" />}>
          <span className="hidden sm:inline">Export CSV</span>
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={range}
            onChange={(value) => setRange(value)}
            tabs={[
              { value: '7', label: 'Last 7 days' },
              { value: '30', label: 'Last 30 days' },
            ]}
            className="border-b-0"
          />
          <Select value={outlet} onChange={(event) => setOutlet(event.target.value)} aria-label="Filter by outlet" className="ml-auto w-auto max-w-[240px]">
            <option value="all">All outlets</option>
            {data.locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </Select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="p-3.5">
              <p className="label-caps">{kpi.label}</p>
              <p className="tabular mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.02em] text-ink-950">{formatNumber(kpi.value)}</p>
              <p className="mt-2 flex items-center gap-1 text-[11px]">
                {kpi.delta === null ? (
                  <span className="text-ink-400">no baseline</span>
                ) : (
                  <>
                    <span className={cn('flex items-center gap-0.5 font-medium', kpi.delta >= 0 ? 'text-pine-700' : 'text-brick-600')}>
                      {kpi.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {formatPercent(kpi.delta)}
                    </span>
                    <span className="text-ink-400">vs previous {days / 2} days</span>
                  </>
                )}
              </p>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader title="Performance trend" description="Portfolio discovery actions" />
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
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader title="By outlet" description="Totals over the selected window" />
            <TableWrap>
              <THead>
                <Th>Outlet</Th>
                <Th align="right">Views</Th>
                <Th align="right">Calls</Th>
                <Th align="right">Directions</Th>
                <Th align="right">Rank</Th>
                <Th>Trend</Th>
              </THead>
              <tbody>
                {perOutlet.map((row) => (
                  <Tr key={row.location.id}>
                    <Td>
                      <p className="text-[13px] font-medium text-ink-900">{row.location.name}</p>
                      <p className="text-[11px] text-ink-400">{row.location.city}</p>
                    </Td>
                    <Td align="right"><span className="tabular">{formatNumber(row.views)}</span></Td>
                    <Td align="right"><span className="tabular">{formatNumber(row.calls)}</span></Td>
                    <Td align="right"><span className="tabular">{formatNumber(row.directions)}</span></Td>
                    <Td align="right">
                      <span className="tabular">{row.rankAverage === null ? '—' : row.rankAverage.toFixed(1)}</span>
                    </Td>
                    <Td>{row.spark.length > 1 && <Sparkline values={row.spark} width={64} height={18} />}</Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrap>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Local rank by keyword" description="Average position across selected outlets" />
              {rankRows.length === 0 ? (
                <EmptyState title="No rank data" description="Rank tracking runs daily once a keyword set is configured." />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {rankRows.map((row) => (
                    <li key={row.keyword} className="flex items-center gap-2 px-3.5 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-800">{row.keyword}</span>
                      <span className="tabular text-[12px] font-semibold text-ink-900">
                        {row.average === null ? '—' : `#${row.average.toFixed(1)}`}
                      </span>
                      {row.movement === 'up' && <Badge tone="positive">up</Badge>}
                      {row.movement === 'down' && <Badge tone="danger">down</Badge>}
                      {row.movement === 'flat' && <Badge tone="neutral">flat</Badge>}
                      {row.movement === 'new' && <Badge tone="info">new</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {selectedGrid && (
              <Card>
                <CardHeader title="Rank grid" description="Position by distance from the outlet" />
                <div className="p-3">
                  <RankGrid cells={selectedGrid} />
                  <p className="mt-2 text-[10px] text-ink-400">Grid is 5×5 around the store · · = not in top 20</p>
                </div>
              </Card>
            )}
          </div>
        </div>

        <p className="text-[11px] text-ink-400">
          Data captured {formatRelative(data.metrics[0]?.captured_on ?? null)}. Rankings refresh daily; performance metrics lag by up to 48 hours in Google Business Profile.
        </p>
      </div>
    </AppShell>
  );
}

export default function ReportsPage() {
  return (
    <PageGuard>
      <ReportsInner />
    </PageGuard>
  );
}
