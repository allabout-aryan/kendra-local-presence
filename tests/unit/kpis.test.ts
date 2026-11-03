import { describe, expect, it } from 'vitest';
import { areaPath, buildSeries, movement, pctDelta, portfolioKpis, sparklinePath, sum, summariseRanks } from '@/lib/domain/kpis';
import type { MetricSnapshot } from '@/lib/domain/types';

const snap = (over: Partial<MetricSnapshot>): MetricSnapshot => ({
  id: 's', org_id: 'o', location_id: 'l', captured_on: '2026-11-01',
  views: 0, searches: 0, calls: 0, direction_requests: 0, website_clicks: 0,
  photo_views: 0, avg_rating: 0, review_count: 0, ...over,
});

describe('sum and pctDelta', () => {
  it('sums a field and ignores non-finite values', () => {
    expect(sum([{ v: 2 }, { v: 3 }, { v: Number.NaN }], (r) => r.v)).toBe(5);
    expect(sum([], (r: { v: number }) => r.v)).toBe(0);
  });

  it('returns null instead of an infinite percentage when there is no baseline', () => {
    expect(pctDelta(10, 0)).toBeNull();
    expect(pctDelta(15, 10)).toBe(50);
    expect(pctDelta(5, 10)).toBe(-50);
  });
});

describe('buildSeries', () => {
  it('creates a dense window with zero-filled days', () => {
    const now = new Date('2026-11-02T12:00:00.000Z');
    const series = buildSeries([snap({ captured_on: '2026-11-01', views: 40, calls: 3 })], 7, now);
    expect(series).toHaveLength(7);
    expect(series[series.length - 1].date).toBe('2026-11-02');
    expect(series.find((p) => p.date === '2026-11-01')?.views).toBe(40);
    expect(series.find((p) => p.date === '2026-10-31')?.views).toBe(0);
  });

  it('sums multiple locations on the same day', () => {
    const now = new Date('2026-11-02T12:00:00.000Z');
    const series = buildSeries(
      [snap({ captured_on: '2026-11-01', views: 10 }), snap({ captured_on: '2026-11-01', views: 15 })],
      3,
      now,
    );
    expect(series.find((p) => p.date === '2026-11-01')?.views).toBe(25);
  });

  it('drops snapshots outside the window', () => {
    const now = new Date('2026-11-02T12:00:00.000Z');
    const series = buildSeries([snap({ captured_on: '2026-01-01', views: 99 })], 5, now);
    expect(series.every((p) => p.views === 0)).toBe(true);
  });
});

describe('sparklinePath', () => {
  it('returns an empty string for no data', () => {
    expect(sparklinePath([], 100, 30)).toBe('');
    expect(areaPath([], 100, 30)).toBe('');
  });

  it('centres a single point on the midline', () => {
    expect(sparklinePath([5], 100, 30, 2)).toBe('M50,15');
  });

  it('draws a flat series on the midline rather than the baseline', () => {
    const path = sparklinePath([4, 4, 4], 100, 30, 2);
    expect(path).toBe('M2,15 L50,15 L98,15');
  });

  it('starts with a move and continues with lines', () => {
    const path = sparklinePath([1, 2, 3], 100, 30);
    expect(path.startsWith('M')).toBe(true);
    expect(path.split('L')).toHaveLength(3);
  });

  it('inverts the y axis so higher values sit higher', () => {
    const path = sparklinePath([0, 10], 100, 100, 0);
    const points = [...path.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((m) => Number(m[2]));
    expect(points).toHaveLength(2);
    expect(points[0]).toBeGreaterThan(points[1]);
  });

  it('closes the area path back to the baseline', () => {
    expect(areaPath([1, 2], 100, 30).endsWith('Z')).toBe(true);
  });
});

describe('summariseRanks', () => {
  it('excludes not-found results from the average', () => {
    const summary = summariseRanks([{ position: 2 }, { position: 4 }, { position: 0 }]);
    expect(summary.average).toBe(3);
    expect(summary.top3).toBe(1);
    expect(summary.notFound).toBe(1);
    expect(summary.total).toBe(3);
  });

  it('reports null average when nothing ranks', () => {
    expect(summariseRanks([{ position: 0 }]).average).toBeNull();
  });

  it('buckets positions into top 3, top 10 and top 20', () => {
    const summary = summariseRanks([{ position: 1 }, { position: 7 }, { position: 14 }, { position: 0 }]);
    expect([summary.top3, summary.top10, summary.top20, summary.notFound]).toEqual([1, 1, 1, 1]);
  });
});

describe('movement', () => {
  it('treats a lower position number as an improvement', () => {
    expect(movement(8, 4)).toBe('up');
    expect(movement(4, 8)).toBe('down');
    expect(movement(4, 4)).toBe('flat');
    expect(movement(null, 5)).toBe('new');
    expect(movement(0, 3)).toBe('new');
  });
});

describe('portfolioKpis', () => {
  const rows = [
    { status: 'active', audit_score: 90, open_reviews: 2, negative_open: 1, avg_rating: 4.5, calls_30d: 100, directions_30d: 200, views_30d: 1000 },
    { status: 'active', audit_score: 60, open_reviews: 4, negative_open: 3, avg_rating: 3.5, calls_30d: 50, directions_30d: 100, views_30d: 500 },
    { status: 'paused', audit_score: 0, open_reviews: 0, negative_open: 0, avg_rating: 0, calls_30d: 0, directions_30d: 0, views_30d: 0 },
  ];

  it('averages only outlets that have a score', () => {
    const kpis = portfolioKpis(rows);
    expect(kpis.avgAudit).toBe(75);
    expect(kpis.locations).toBe(3);
    expect(kpis.activeLocations).toBe(2);
  });

  it('counts outlets at risk below the attention threshold', () => {
    expect(portfolioKpis(rows).atRisk).toBe(1);
  });

  it('rolls up traffic and review backlog', () => {
    const kpis = portfolioKpis(rows);
    expect(kpis.calls30d).toBe(150);
    expect(kpis.directions30d).toBe(300);
    expect(kpis.openReviews).toBe(6);
    expect(kpis.negativeOpen).toBe(4);
    expect(kpis.avgRating).toBe(4);
  });
});
