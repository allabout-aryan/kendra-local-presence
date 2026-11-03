import { describe, expect, it } from 'vitest';
import { formatCompact, formatCurrency, formatNumber, formatPercent, formatRelative, initials } from '@/lib/domain/format';

describe('formatCompact', () => {
  it('uses lakh and crore for Indian readers', () => {
    expect(formatCompact(1_20_000)).toBe('1.2L');
    expect(formatCompact(4_50_00_000)).toBe('4.5Cr');
    expect(formatCompact(1_00_000)).toBe('1L');
  });

  it('falls back to thousands and plain numbers below that', () => {
    expect(formatCompact(1_500)).toBe('1.5k');
    expect(formatCompact(940)).toBe('940');
  });

  it('handles null without printing NaN', () => {
    expect(formatCompact(null)).toBe('—');
    expect(formatCompact(Number.NaN)).toBe('—');
  });
});

describe('formatNumber', () => {
  it('groups digits the Indian way', () => {
    expect(formatNumber(12_34_567)).toBe('12,34,567');
  });
});

describe('formatCurrency', () => {
  it('renders rupees without paise by default', () => {
    expect(formatCurrency(1499)).toContain('1,499');
    expect(formatCurrency(1499)).toContain('₹');
  });
});

describe('formatPercent', () => {
  it('signs positive deltas and dashes nulls', () => {
    expect(formatPercent(12.4)).toBe('+12%');
    expect(formatPercent(-3.6, 1)).toBe('-3.6%');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('formatRelative', () => {
  it('describes recent timestamps', () => {
    const now = Date.now();
    expect(formatRelative(new Date(now - 30_000).toISOString())).toBe('just now');
    expect(formatRelative(new Date(now - 5 * 60_000).toISOString())).toBe('5m ago');
    expect(formatRelative(new Date(now - 3 * 3_600_000).toISOString())).toBe('3h ago');
  });

  it('says never for a missing timestamp', () => {
    expect(formatRelative(null)).toBe('never');
    expect(formatRelative('not-a-date')).toBe('never');
  });
});

describe('initials', () => {
  it('takes the first letter of the first two words', () => {
    expect(initials('Aarti Rao')).toBe('AR');
    expect(initials('mihir')).toBe('M');
    expect(initials(null)).toBe('··');
  });
});
