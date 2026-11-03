import { describe, expect, it } from 'vitest';
import { SLA_HOURS, formatDuration, isOverdue, median, responseHours, summariseSla } from '@/lib/domain/sla';
import type { Review } from '@/lib/domain/types';

const NOW = new Date('2026-11-03T12:00:00.000Z');

function review(over: Partial<Review>): Review {
  return {
    id: 'r', org_id: 'o', location_id: 'l', author_name: 'A', rating: 3, comment: 'c',
    sentiment: 'neutral', status: 'new', draft_text: null, draft_source: null, reply_text: null,
    replied_at: null, published_at: NOW.toISOString(), ...over,
  } as Review;
}

const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

describe('responseHours', () => {
  it('measures from publication to reply', () => {
    expect(responseHours({ published_at: hoursAgo(30), replied_at: hoursAgo(6) })).toBe(24);
  });

  it('returns null when there is no reply', () => {
    expect(responseHours({ published_at: hoursAgo(30), replied_at: null })).toBeNull();
  });

  it('never returns a negative duration', () => {
    expect(responseHours({ published_at: hoursAgo(1), replied_at: hoursAgo(5) })).toBe(0);
  });
});

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('isOverdue', () => {
  it('flags unreplied reviews past the SLA', () => {
    expect(isOverdue({ published_at: hoursAgo(SLA_HOURS + 1), replied_at: null, status: 'new' }, NOW)).toBe(true);
    expect(isOverdue({ published_at: hoursAgo(2), replied_at: null, status: 'new' }, NOW)).toBe(false);
  });

  it('does not flag replied or ignored reviews', () => {
    expect(isOverdue({ published_at: hoursAgo(100), replied_at: hoursAgo(90), status: 'replied' }, NOW)).toBe(false);
    expect(isOverdue({ published_at: hoursAgo(100), replied_at: null, status: 'ignored' }, NOW)).toBe(false);
  });
});

describe('summariseSla', () => {
  const reviews = [
    review({ id: '1', published_at: hoursAgo(50), replied_at: hoursAgo(40), status: 'replied' }), // 10h
    review({ id: '2', published_at: hoursAgo(60), replied_at: hoursAgo(0), status: 'replied' }),  // 60h
    review({ id: '3', published_at: hoursAgo(80), status: 'new' }),                               // overdue
    review({ id: '4', published_at: hoursAgo(1), status: 'new' }),                                // fresh
    review({ id: '5', published_at: hoursAgo(200), status: 'ignored' }),
  ];

  it('counts answered, open and overdue separately', () => {
    const summary = summariseSla(reviews, NOW);
    expect(summary.answered).toBe(2);
    expect(summary.open).toBe(2);
    expect(summary.overdue).toBe(1);
  });

  it('computes the median and the share inside the SLA', () => {
    const summary = summariseSla(reviews, NOW);
    expect(summary.medianHours).toBe(35);
    expect(summary.withinSla).toBe(1);
    expect(summary.withinSlaPct).toBe(50);
    expect(summary.slowestHours).toBe(60);
  });

  it('returns nulls rather than zeros when nothing has been answered', () => {
    const summary = summariseSla([review({ published_at: hoursAgo(1) })], NOW);
    expect(summary.medianHours).toBeNull();
    expect(summary.withinSlaPct).toBeNull();
  });
});

describe('formatDuration', () => {
  it('reads naturally at every scale', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(0.5)).toBe('30m');
    expect(formatDuration(6)).toBe('6.0h');
    expect(formatDuration(30)).toBe('30h');
    expect(formatDuration(72)).toBe('3.0d');
  });
});
