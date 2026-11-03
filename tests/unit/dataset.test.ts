import { describe, expect, it } from 'vitest';
import { buildDemoDataset } from '@/lib/data/demo';
import { evaluateAudit } from '@/lib/domain/audit';
import { applyHoursPatch } from '@/lib/domain/hours';

/**
 * The demo workspace is what the public URL serves, so it gets treated as real
 * data: referential integrity, score consistency and determinism are asserted.
 */
describe('demo dataset', () => {
  const dataset = buildDemoDataset(new Date('2026-11-02T10:00:00.000Z'));

  it('builds a coherent portfolio', () => {
    expect(dataset.locations).toHaveLength(10);
    expect(dataset.locations.every((location) => location.org_id === dataset.org.id)).toBe(true);
    expect(dataset.members.length).toBeGreaterThanOrEqual(4);
    expect(dataset.connection?.status).toBe('connected');
  });

  it('keeps reviews referentially intact', () => {
    const locationIds = new Set(dataset.locations.map((location) => location.id));
    expect(dataset.reviews.length).toBeGreaterThan(20);
    for (const review of dataset.reviews) {
      expect(locationIds.has(review.location_id)).toBe(true);
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
      expect(review.location_name).toBeTruthy();
    }
  });

  it('gives every outlet 30 days of metrics with one row per day', () => {
    const byLocation = new Map<string, Set<string>>();
    for (const snapshot of dataset.metrics) {
      const set = byLocation.get(snapshot.location_id) ?? new Set<string>();
      set.add(snapshot.captured_on);
      byLocation.set(snapshot.location_id, set);
    }
    expect(byLocation.size).toBe(dataset.locations.length);
    for (const days of byLocation.values()) expect(days.size).toBe(30);
  });

  it('produces a full 5x5 rank grid per keyword', () => {
    for (const rank of dataset.ranks) {
      expect(rank.grid).toHaveLength(25);
      expect(rank.position).toBeGreaterThanOrEqual(0);
      expect(rank.grid!.every((cell) => cell.position >= 0 && cell.position <= 20)).toBe(true);
    }
  });

  it('scores every outlet with the same rule engine the UI uses', () => {
    for (const location of dataset.locations) {
      const reviews = dataset.reviews.filter((review) => review.location_id === location.id);
      const openNegative = reviews.filter((r) => r.sentiment === 'negative' && r.status !== 'replied' && r.status !== 'ignored').length;
      const rated = reviews.filter((r) => r.rating > 0);
      const result = evaluateAudit({
        location,
        openNegativeReviews: openNegative,
        avgRating: rated.length ? rated.reduce((total, r) => total + r.rating, 0) / rated.length : 0,
        totalReviews: reviews.length,
        // mirrors useAuditResults(): duplicates are same-name outlets in the portfolio
        duplicateSuspects: dataset.locations.filter(
          (other) => other.id !== location.id && other.name.trim().toLowerCase() === location.name.trim().toLowerCase(),
        ).length,
        now: new Date('2026-11-02T10:00:00.000Z'),
      });
      expect(result.score).toBe(location.audit_score);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic across builds', () => {
    const again = buildDemoDataset(new Date('2026-11-02T10:00:00.000Z'));
    expect(again.locations.map((l) => l.id)).toEqual(dataset.locations.map((l) => l.id));
    expect(again.locations.map((l) => l.audit_score)).toEqual(dataset.locations.map((l) => l.audit_score));
    expect(again.reviews.map((r) => r.id)).toEqual(dataset.reviews.map((r) => r.id));
  });

  it('includes at least one outlet in each audit band', () => {
    const scores = dataset.locations.map((location) => location.audit_score);
    expect(scores.some((score) => score >= 85)).toBe(true);
    expect(scores.some((score) => score >= 65 && score < 85)).toBe(true);
    expect(scores.some((score) => score < 65)).toBe(true);
  });
});

describe('bulk hours patch as the store applies it', () => {
  it('preserves an outlet weekly-off day while updating the rest', () => {
    const current = {
      mon: { open: '09:00', close: '18:00' },
      tue: null,
      wed: { open: '09:00', close: '18:00' },
    };
    const patched = applyHoursPatch(current, { mon: { open: '10:00', close: '20:00' }, tue: { open: '10:00', close: '20:00' } }, true);
    expect(patched.mon).toEqual({ open: '10:00', close: '20:00' });
    expect(patched.tue).toBeNull();
    expect(patched.wed).toEqual({ open: '09:00', close: '18:00' });
  });

  it('overrides a closed day when the operator asks for it', () => {
    const patched = applyHoursPatch({ tue: null }, { tue: { open: '10:00', close: '20:00' } }, false);
    expect(patched.tue).toEqual({ open: '10:00', close: '20:00' });
  });
});
