import { describe, expect, it } from 'vitest';
import { findDuplicateGroups, normaliseName, planMerge } from '@/lib/domain/duplicates';
import { makeLocation } from './fixtures';

describe('normaliseName', () => {
  it('ignores punctuation and legal suffixes', () => {
    expect(normaliseName('Blue Tokai Coffee Roasters Pvt Ltd')).toBe('blue tokai coffee roasters');
    expect(normaliseName('The Coffee Co.')).toBe('coffee co');
    expect(normaliseName('  Indiranagar  ')).toBe('indiranagar');
  });
});

describe('findDuplicateGroups', () => {
  const strong = makeLocation({
    id: 'loc-strong', name: 'Bandra West', city: 'Mumbai', gbp_location_id: 'gbp-1', photo_count: 18,
    created_at: '2025-01-01T00:00:00.000Z',
  });
  const weak = makeLocation({
    id: 'loc-weak', name: 'Bandra West', city: 'Mumbai', gbp_location_id: null, photo_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
  });
  const elsewhere = makeLocation({ id: 'loc-other', name: 'Bandra West', city: 'Pune' });
  const unique = makeLocation({ id: 'loc-unique', name: 'Koregaon Park', city: 'Pune' });

  it('groups only same name in the same city', () => {
    const groups = findDuplicateGroups([strong, weak, elsewhere, unique]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members.map((member) => member.id).sort()).toEqual(['loc-strong', 'loc-weak']);
  });

  it('picks the stronger profile as the keeper', () => {
    const [group] = findDuplicateGroups([weak, strong]);
    expect(group.keeper.id).toBe('loc-strong');
    expect(group.mergeIds).toEqual(['loc-weak']);
    expect(group.reason).toMatch(/share this name/i);
  });

  it('returns nothing when there are no duplicates', () => {
    expect(findDuplicateGroups([unique, elsewhere])).toEqual([]);
  });

  it('plans what a merge moves', () => {
    const [group] = findDuplicateGroups([strong, weak]);
    const plan = planMerge(group, {
      reviews: { 'loc-weak': 7 },
      metrics: { 'loc-weak': 30 },
      ranks: { 'loc-weak': 5 },
    });
    expect(plan).toEqual({ keeperId: 'loc-strong', mergeIds: ['loc-weak'], reviewsMoved: 7, metricsMoved: 30, ranksDropped: 5 });
  });
});
