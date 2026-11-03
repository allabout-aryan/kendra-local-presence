import { describe, expect, it } from 'vitest';
import { csvFilename, toCsv } from '@/lib/domain/csv';

describe('toCsv', () => {
  it('writes a header row and a trailing newline', () => {
    const csv = toCsv(['Outlet', 'Score'], [['Indiranagar', 82]]);
    expect(csv).toBe('Outlet,Score\nIndiranagar,82\n');
  });

  it('quotes cells containing commas, quotes or newlines', () => {
    const csv = toCsv(['Note'], [['Indiranagar, Bengaluru'], ['He said "hello"'], ['two\nlines']]);
    expect(csv).toContain('"Indiranagar, Bengaluru"');
    expect(csv).toContain('"He said ""hello"""');
    expect(csv).toContain('"two\nlines"');
  });

  it('renders nulls and undefined as empty cells', () => {
    expect(toCsv(['A', 'B'], [[null, undefined]])).toBe('A,B\n,\n');
  });

  it('neutralises spreadsheet formula injection', () => {
    const csv = toCsv(['Name'], [['=cmd|calc']]);
    expect(csv).toContain('\t=cmd|calc');
  });

  it('handles booleans and zero without dropping them', () => {
    expect(toCsv(['A', 'B'], [[true, 0]])).toBe('A,B\ntrue,0\n');
  });
});

describe('csvFilename', () => {
  it('stamps the file with the ISO date', () => {
    expect(csvFilename('kendra-locations', new Date('2026-11-02T09:00:00.000Z'))).toBe('kendra-locations-2026-11-02.csv');
  });
});
