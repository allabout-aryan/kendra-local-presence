import { describe, expect, it } from 'vitest';
import { classifySentiment, detectIssue, draftReply, isReplySafe } from '@/lib/domain/reviews';

describe('classifySentiment', () => {
  it('treats one and two star reviews as negative regardless of wording', () => {
    expect(classifySentiment(1, 'Loved it')).toBe('negative');
    expect(classifySentiment(2, null)).toBe('negative');
  });

  it('keeps a high rating positive when there is no complaint', () => {
    expect(classifySentiment(5, 'Excellent coffee and lovely staff')).toBe('positive');
  });

  it('downgrades a four star review that still carries a complaint', () => {
    expect(classifySentiment(4, 'Good coffee but we waited twenty minutes')).toBe('neutral');
  });

  it('uses signal words to break ties on three stars', () => {
    expect(classifySentiment(3, 'The staff were rude and the table was dirty')).toBe('negative');
    expect(classifySentiment(3, 'Friendly staff, quick service')).toBe('positive');
    expect(classifySentiment(3, 'It was fine')).toBe('neutral');
  });
});

describe('detectIssue', () => {
  it('recognises wait time complaints', () => {
    expect(detectIssue('We waited 40 minutes for a flat white')?.key).toBe('wait_time');
  });

  it('recognises cleanliness complaints', () => {
    expect(detectIssue('The washroom was dirty and there was a smell')?.key).toBe('cleanliness');
  });

  it('returns null when there is nothing specific', () => {
    expect(detectIssue('Nice place')).toBeNull();
    expect(detectIssue(null)).toBeNull();
  });
});

describe('draftReply', () => {
  const base = { authorName: 'Kavya Nair', locationName: 'Indiranagar', brandName: 'Blue Tokai' };

  it('thanks a five star reviewer by first name and names the outlet', () => {
    const { text, source } = draftReply({ ...base, rating: 5, comment: 'Best filter coffee in Bengaluru' });
    expect(source).toBe('rule');
    expect(text).toContain('Kavya');
    expect(text).toContain('Indiranagar');
    expect(text).toContain('Blue Tokai');
  });

  it('apologises for a one star review and names the issue', () => {
    const { text, issue } = draftReply({ ...base, rating: 1, comment: 'Waited 40 minutes for a flat white' });
    expect(text.toLowerCase()).toContain('sorry');
    expect(issue).toBe('wait_time');
  });

  it('never promises a refund', () => {
    const { text } = draftReply({ ...base, rating: 1, comment: 'I want a refund' });
    expect(isReplySafe(text).ok).toBe(true);
    expect(text.toLowerCase()).not.toContain('we will refund');
  });

  it('stays inside the character budget for every rating', () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      const { text } = draftReply({ ...base, rating, comment: 'Waited 30 minutes and it was overpriced' });
      expect(text.length).toBeLessThan(1200);
      expect(text.length).toBeGreaterThan(20);
    }
  });

  it('falls back to a first name when the author is a single word', () => {
    const { text } = draftReply({ ...base, authorName: 'Anonymous', rating: 4, comment: null });
    expect(text).toContain('Anonymous');
  });
});

describe('isReplySafe', () => {
  it('rejects refund promises', () => {
    const result = isReplySafe('Sorry about this. We will refund the full amount to you today.');
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toContain('refunds');
  });

  it('rejects replies that are too short to send', () => {
    expect(isReplySafe('Thanks!').ok).toBe(false);
  });

  it('rejects absolute claims', () => {
    expect(isReplySafe('This never happens at our outlets, we always check the temperature twice.').ok).toBe(false);
  });

  it('accepts a normal apology', () => {
    expect(isReplySafe('Priya, I am sorry about the wait. I have passed this to the store manager.').ok).toBe(true);
  });
});
