import { describe, expect, it } from 'vitest';
import { buildHeatmap } from '@/lib/domain/heatmap';
import type { MetricSnapshot } from '@/lib/domain/types';

const NOW = new Date('2026-11-03T12:00:00.000Z');

const snap = (captured_on: string, views: number): MetricSnapshot => ({
  id: captured_on, org_id: 'o', location_id: 'l', captured_on, views,
  searches: 0, calls: 0, direction_requests: 0, website_clicks: 0, photo_views: 0,
  avg_rating: 0, review_count: 0,
});

describe('buildHeatmap', () => {
  it('produces one cell per day in the window', () => {
    const heatmap = buildHeatmap([], 28, (snapshot) => snapshot.views, NOW);
    const cells = heatmap.weeks.flat().filter((cell): cell is NonNullable<typeof cell> => cell !== null);
    expect(cells).toHaveLength(28);
    expect(heatmap.total).toBe(0);
    expect(cells.every((cell) => cell.level === 0)).toBe(true);
  });

  it('sums multiple outlets on the same day', () => {
    const heatmap = buildHeatmap([snap('2026-11-02', 40), snap('2026-11-02', 60)], 7, (s) => s.views, NOW);
    const cell = heatmap.weeks.flat().find((entry) => entry?.date === '2026-11-02');
    expect(cell?.value).toBe(100);
    expect(heatmap.total).toBe(100);
  });

  it('grades days into five levels', () => {
    const snapshots = [
      snap('2026-11-03', 0), snap('2026-11-02', 10), snap('2026-11-01', 20),
      snap('2026-10-31', 30), snap('2026-10-30', 40),
    ];
    const heatmap = buildHeatmap(snapshots, 7, (s) => s.views, NOW);
    const levels = new Set(heatmap.weeks.flat().filter((cell) => cell !== null).map((cell) => cell!.level));
    expect(levels.has(0)).toBe(true);
    expect(levels.has(4)).toBe(true);
  });

  it('aligns every column to Monday with leading blanks', () => {
    const heatmap = buildHeatmap([], 21, (s) => s.views, NOW);
    expect(heatmap.weeks.every((week) => week.length === 7)).toBe(true);
    for (const week of heatmap.weeks) {
      week.forEach((cell, index) => {
        if (!cell) return;
        const weekday = new Date(`${cell.date}T00:00:00Z`).getUTCDay();
        expect(index).toBe((weekday + 6) % 7);
      });
    }
    // the window starts on a Wednesday, so the first two slots are blank
    expect(heatmap.weeks[0][0]).toBeNull();
    expect(heatmap.weeks[0][2]?.date).toBe('2026-10-14');
  });

  it('ignores snapshots outside the window', () => {
    const heatmap = buildHeatmap([snap('2025-01-01', 999)], 7, (s) => s.views, NOW);
    expect(heatmap.total).toBe(0);
  });
});
