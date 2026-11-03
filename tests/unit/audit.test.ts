import { describe, expect, it } from 'vitest';
import { evaluateAudit, portfolioFixRanking, scoreBand } from '@/lib/domain/audit';
import { makeLocation, NOW } from './fixtures';

const LONG_DESCRIPTION =
  'A neighbourhood coffee roastery on 100 Feet Road in Indiranagar serving single-origin espresso, filter coffee and fresh bakes through the day. We roast in small batches every Tuesday, run public cuppings on weekends, and keep twenty seats for people who want to work through the afternoon.';

const healthy = () =>
  evaluateAudit({
    location: makeLocation({ description: LONG_DESCRIPTION }),
    openNegativeReviews: 0,
    avgRating: 4.6,
    totalReviews: 128,
    duplicateSuspects: 0,
    now: NOW,
  });

describe('evaluateAudit', () => {
  it('gives a complete outlet a perfect score and no findings', () => {
    const result = healthy();
    expect(result.score).toBe(100);
    expect(result.findings).toHaveLength(0);
    expect(result.band).toBe('healthy');
    expect(result.topFix).toBeNull();
  });

  it('penalises a missing primary category by 15 points', () => {
    const result = evaluateAudit({
      location: makeLocation({ description: LONG_DESCRIPTION, primary_category: null }),
      openNegativeReviews: 0,
      avgRating: 4.6,
      totalReviews: 10,
      now: NOW,
    });
    expect(result.score).toBe(85);
    expect(result.findings.map((f) => f.rule_key)).toContain('missing_category');
  });

  it('names the exact days that have no hours', () => {
    const result = evaluateAudit({
      location: makeLocation({
        description: LONG_DESCRIPTION,
        hours: { mon: { open: '09:00', close: '21:00' }, tue: { open: '09:00', close: '21:00' } },
      }),
      openNegativeReviews: 0,
      avgRating: 4.5,
      totalReviews: 10,
      now: NOW,
    });
    const finding = result.findings.find((f) => f.rule_key === 'missing_hours');
    expect(finding?.detail).toContain('5 day(s)');
    expect(finding?.detail).toContain('WED');
  });

  it('counts no photos once, not twice with the stale-photo rule', () => {
    const result = evaluateAudit({
      location: makeLocation({ description: LONG_DESCRIPTION, photo_count: 0, last_photo_at: null }),
      openNegativeReviews: 0,
      avgRating: 4.5,
      totalReviews: 10,
      now: NOW,
    });
    const keys = result.findings.map((f) => f.rule_key);
    expect(keys).toContain('no_photos');
    expect(keys).not.toContain('stale_photos');
    expect(result.score).toBe(86);
  });

  it('flags photos older than 90 days', () => {
    const old = new Date(NOW);
    old.setDate(old.getDate() - 120);
    const result = evaluateAudit({
      location: makeLocation({ description: LONG_DESCRIPTION, last_photo_at: old.toISOString() }),
      openNegativeReviews: 0,
      avgRating: 4.5,
      totalReviews: 10,
      now: NOW,
    });
    expect(result.findings.map((f) => f.rule_key)).toContain('stale_photos');
  });

  it('treats unanswered negative reviews as the top fix when they are the biggest loss', () => {
    const result = evaluateAudit({
      location: makeLocation({ description: LONG_DESCRIPTION }),
      openNegativeReviews: 3,
      avgRating: 3.4,
      totalReviews: 40,
      now: NOW,
    });
    expect(result.findings[0].rule_key).toBe('unanswered_negative');
    // 12 for the backlog plus 6 for a sub-4.0 rating
    expect(result.score).toBe(82);
  });

  it('flags possible duplicate listings', () => {
    const result = evaluateAudit({
      location: makeLocation({ description: LONG_DESCRIPTION }),
      openNegativeReviews: 0,
      avgRating: 4.5,
      totalReviews: 10,
      duplicateSuspects: 2,
      now: NOW,
    });
    expect(result.findings.find((f) => f.rule_key === 'duplicate_listing')?.detail).toContain('2 other profile(s)');
  });

  it('stays inside 0–100 even when everything is wrong', () => {
    const result = evaluateAudit({
      location: makeLocation({
        name: 'Bare outlet',
        store_code: null,
        primary_category: null,
        additional_categories: [],
        description: null,
        hours: {},
        phone: null,
        website: null,
        address_line1: null,
        city: null,
        postal_code: null,
        photo_count: 0,
        last_photo_at: null,
      }),
      openNegativeReviews: 4,
      avgRating: 2.1,
      totalReviews: 12,
      duplicateSuspects: 1,
      now: NOW,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(5);
    expect(result.findings.length).toBeGreaterThanOrEqual(10);
    expect(result.band).toBe('critical');
  });

  it('bands scores at the documented thresholds', () => {
    expect(scoreBand(96)).toBe('healthy');
    expect(scoreBand(85)).toBe('healthy');
    expect(scoreBand(84)).toBe('attention');
    expect(scoreBand(65)).toBe('attention');
    expect(scoreBand(64)).toBe('critical');
  });
});

describe('portfolioFixRanking', () => {
  it('ranks fixes by total points recoverable across the portfolio', () => {
    const a = evaluateAudit({
      location: makeLocation({ description: LONG_DESCRIPTION, primary_category: null }),
      openNegativeReviews: 0,
      avgRating: 4.5,
      totalReviews: 10,
      now: NOW,
    });
    const b = evaluateAudit({
      location: makeLocation({ description: LONG_DESCRIPTION, primary_category: null, photo_count: 0 }),
      openNegativeReviews: 0,
      avgRating: 4.5,
      totalReviews: 10,
      now: NOW,
    });
    const ranking = portfolioFixRanking([a, b]);
    expect(ranking[0].rule_key).toBe('missing_category');
    expect(ranking[0].locations).toBe(2);
    expect(ranking[0].points).toBe(30);
  });
});
