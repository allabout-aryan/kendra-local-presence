import { describe, expect, it } from 'vitest';
import {
  applyHoursPatch,
  hasHoursGap,
  hoursSummary,
  isValidTime,
  missingDays,
  normalizeHours,
  openDays,
  totalWeeklyHours,
} from '@/lib/domain/hours';

const weekday = { open: '08:00', close: '22:00' };
const weekend = { open: '09:00', close: '23:00' };

describe('normalizeHours', () => {
  it('keeps only known weekdays with valid times', () => {
    const result = normalizeHours({
      mon: weekday,
      tue: { open: '25:00', close: '22:00' },
      wed: { open: '9:00', close: '22:00' },
      thu: null,
      fri: 'not an object',
      funday: weekday,
    });
    expect(result.mon).toEqual(weekday);
    expect(result.tue).toBeUndefined();
    expect(result.wed).toBeUndefined();
    expect(result.thu).toBeNull();
    expect(result.fri).toBeUndefined();
    expect(Object.keys(result)).not.toContain('funday');
  });

  it('returns an empty object for junk input', () => {
    expect(normalizeHours(null)).toEqual({});
    expect(normalizeHours('monday')).toEqual({});
    expect(normalizeHours([])).toEqual({});
  });
});

describe('hours coverage', () => {
  it('lists missing days in weekday order', () => {
    const hours = { mon: weekday, tue: weekday, sat: weekend };
    expect(missingDays(hours)).toEqual(['wed', 'thu', 'fri', 'sun']);
    expect(openDays(hours)).toEqual(['mon', 'tue', 'sat']);
    expect(hasHoursGap(hours)).toBe(true);
    expect(hasHoursGap({ mon: weekday })).toBe(true);
  });

  it('totals weekly open hours', () => {
    const hours = { mon: { open: '09:00', close: '17:00' }, tue: { open: '09:00', close: '13:00' } };
    expect(totalWeeklyHours(hours)).toBe(12);
  });

  it('ignores closed days in the total', () => {
    const hours = { mon: { open: '09:00', close: '17:00' }, tue: null };
    expect(totalWeeklyHours(hours)).toBe(8);
  });
});

describe('hoursSummary', () => {
  it('groups consecutive days that share hours', () => {
    const summary = hoursSummary({
      mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: weekend, sun: weekend,
    });
    expect(summary).toBe('Mon–Fri 8am–10pm · Sat–Sun 9am–11pm');
  });

  it('marks closed days and unknown days differently', () => {
    const summary = hoursSummary({ mon: weekday, tue: weekday, wed: null });
    expect(summary).toContain('Wed closed');
    expect(summary).toContain('Thu–Sun unknown');
  });

  it('renders minutes when they are not on the hour', () => {
    expect(hoursSummary({ mon: { open: '09:30', close: '21:15' } })).toContain('Mon 9:30am–9:15pm');
  });
});

describe('applyHoursPatch', () => {
  const current = { mon: weekday, tue: weekday, wed: null };

  it('patches only the days present in the patch', () => {
    const next = applyHoursPatch(current, { mon: weekend });
    expect(next.mon).toEqual(weekend);
    expect(next.tue).toEqual(weekday);
  });

  it('leaves closed days alone by default', () => {
    const next = applyHoursPatch(current, { wed: weekday });
    expect(next.wed).toBeNull();
  });

  it('overwrites closed days when explicitly asked', () => {
    const next = applyHoursPatch(current, { wed: weekday }, false);
    expect(next.wed).toEqual(weekday);
  });
});

describe('isValidTime', () => {
  it('accepts 24-hour times only', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
    expect(isValidTime('09:60')).toBe(false);
  });
});
