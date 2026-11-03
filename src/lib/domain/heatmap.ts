import type { MetricSnapshot } from './types';

export interface HeatCell {
  date: string;
  value: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface Heatmap {
  /** Monday-aligned columns; nulls are the days before/after the window. */
  weeks: (HeatCell | null)[][];
  max: number;
  total: number;
  levels: number[];
}

function quantile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length));
  return sorted[index];
}

/**
 * Calendar heatmap of daily discovery actions. Levels use quartiles of the
 * observed data rather than fixed buckets, so a quiet portfolio still reads.
 */
export function buildHeatmap(
  snapshots: MetricSnapshot[],
  days = 91,
  metric: (snapshot: MetricSnapshot) => number = (snapshot) => snapshot.views,
  now = new Date(),
): Heatmap {
  const byDate = new Map<string, number>();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    byDate.set(date.toISOString().slice(0, 10), 0);
  }
  for (const snapshot of snapshots) {
    if (!byDate.has(snapshot.captured_on)) continue;
    byDate.set(snapshot.captured_on, (byDate.get(snapshot.captured_on) ?? 0) + metric(snapshot));
  }

  const values = [...byDate.values()];
  const sorted = [...values].sort((a, b) => a - b);
  const thresholds = [quantile(sorted, 0.25), quantile(sorted, 0.5), quantile(sorted, 0.75)];
  const max = values.length ? Math.max(...values) : 0;

  const cells: HeatCell[] = [...byDate.entries()].map(([date, value]) => {
    let level: HeatCell['level'] = 0;
    if (value > 0) level = 1;
    if (value > thresholds[0]) level = 2;
    if (value > thresholds[1]) level = 3;
    if (value > thresholds[2]) level = 4;
    return { date, value, level };
  });

  // pad so the first column starts on a Monday, then chunk into weeks
  const firstDay = new Date(cells[0]?.date ?? new Date()).getDay(); // 0 = Sunday
  const pad = (firstDay + 6) % 7;
  const padded: (HeatCell | null)[] = [...Array.from({ length: pad }, () => null), ...cells];
  while (padded.length % 7 !== 0) padded.push(null);
  const weeks: (HeatCell | null)[][] = [];
  for (let index = 0; index < padded.length; index += 7) {
    weeks.push(padded.slice(index, index + 7));
  }

  return {
    weeks,
    max,
    total: values.reduce((total, value) => total + value, 0),
    levels: thresholds,
  };
}
