import type { MetricSnapshot, RankSnapshot } from './types';

export function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + (Number.isFinite(pick(row)) ? pick(row) : 0), 0);
}

/** Null means "no baseline" — the UI shows a dash instead of a fake +100%. */
export function pctDelta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export interface SeriesPoint {
  date: string;
  views: number;
  calls: number;
  directions: number;
  websiteClicks: number;
}

export function buildSeries(snapshots: MetricSnapshot[], days = 30, now = new Date()): SeriesPoint[] {
  const byDate = new Map<string, SeriesPoint>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDate.set(key, { date: key, views: 0, calls: 0, directions: 0, websiteClicks: 0 });
  }
  for (const snap of snapshots) {
    const point = byDate.get(snap.captured_on);
    if (!point) continue;
    point.views += snap.views;
    point.calls += snap.calls;
    point.directions += snap.direction_requests;
    point.websiteClicks += snap.website_clicks;
  }
  return [...byDate.values()];
}

/** Builds an SVG polyline path. Pure, so the chart is testable without a DOM. */
export function sparklinePath(values: number[], width: number, height: number, padding = 2): string {
  if (values.length === 0) return '';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const flat = max === min;
  const span = flat ? 1 : max - min;
  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);
  return values
    .map((value, index) => {
      const x = padding + (values.length === 1 ? usableWidth / 2 : (index / (values.length - 1)) * usableWidth);
      // A flat series sits on the midline, not the baseline, so it does not
      // read as "zero" on a sparkline.
      const y = flat ? padding + usableHeight / 2 : padding + usableHeight - ((value - min) / span) * usableHeight;
      return `${index === 0 ? 'M' : 'L'}${round(x)},${round(y)}`;
    })
    .join(' ');
}

export function areaPath(values: number[], width: number, height: number, padding = 2): string {
  const line = sparklinePath(values, width, height, padding);
  if (!line) return '';
  return `${line} L${round(width - padding)},${round(height - padding)} L${round(padding)},${round(height - padding)} Z`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface RankSummary {
  average: number | null;
  top3: number;
  top10: number;
  top20: number;
  notFound: number;
  total: number;
}

/** position 0 means "not found in the top 20" — it must not be averaged in. */
export function summariseRanks(rows: Pick<RankSnapshot, 'position'>[]): RankSummary {
  const found = rows.filter((row) => row.position > 0);
  const total = rows.length;
  return {
    average: found.length ? found.reduce((t, r) => t + r.position, 0) / found.length : null,
    top3: rows.filter((r) => r.position > 0 && r.position <= 3).length,
    top10: rows.filter((r) => r.position > 3 && r.position <= 10).length,
    top20: rows.filter((r) => r.position > 10 && r.position <= 20).length,
    notFound: rows.filter((r) => r.position === 0).length,
    total,
  };
}

export function movement(previous: number | null, current: number | null): 'up' | 'down' | 'flat' | 'new' {
  if (previous === null && current === null) return 'flat';
  if (previous === null || previous === 0) return current ? 'new' : 'flat';
  if (current === null) return 'flat';
  if (current < previous) return 'up'; // lower position number = better rank
  if (current > previous) return 'down';
  return 'flat';
}

export interface PortfolioKpis {
  locations: number;
  activeLocations: number;
  avgAudit: number;
  openReviews: number;
  negativeOpen: number;
  avgRating: number;
  calls30d: number;
  directions30d: number;
  views30d: number;
  atRisk: number;
}

export function portfolioKpis(health: {
  status: string;
  audit_score: number;
  open_reviews: number;
  negative_open: number;
  avg_rating: number;
  calls_30d: number;
  directions_30d: number;
  views_30d: number;
}[]): PortfolioKpis {
  const locations = health.length;
  const scored = health.filter((h) => h.audit_score > 0);
  const rated = health.filter((h) => h.avg_rating > 0);
  return {
    locations,
    activeLocations: health.filter((h) => h.status === 'active').length,
    avgAudit: scored.length ? sum(scored, (h) => h.audit_score) / scored.length : 0,
    openReviews: sum(health, (h) => h.open_reviews),
    negativeOpen: sum(health, (h) => h.negative_open),
    avgRating: rated.length ? sum(rated, (h) => h.avg_rating) / rated.length : 0,
    calls30d: sum(health, (h) => h.calls_30d),
    directions30d: sum(health, (h) => h.directions_30d),
    views30d: sum(health, (h) => h.views_30d),
    atRisk: health.filter((h) => h.audit_score > 0 && h.audit_score < 65).length,
  };
}
