import { describe, expect, it } from 'vitest';
import { SAMPLE_CSV, parseCsv, previewImport } from '@/lib/domain/csvImport';

describe('parseCsv', () => {
  it('parses a simple file and normalises headers', () => {
    const parsed = parseCsv('Outlet Name,City\nIndiranagar,Bengaluru\n');
    expect(parsed.headers).toEqual(['outlet_name', 'city']);
    expect(parsed.rows).toEqual([['Indiranagar', 'Bengaluru']]);
    expect(parsed.errors).toEqual([]);
  });

  it('handles quoted fields containing commas', () => {
    const parsed = parseCsv('name,city\n"Indiranagar, 100 Feet Road",Bengaluru\n');
    expect(parsed.rows[0]).toEqual(['Indiranagar, 100 Feet Road', 'Bengaluru']);
  });

  it('handles escaped quotes and embedded newlines', () => {
    const parsed = parseCsv('name,description\n"Store ""A""","line one\nline two"\n');
    expect(parsed.rows[0][0]).toBe('Store "A"');
    expect(parsed.rows[0][1]).toBe('line one\nline two');
  });

  it('handles CRLF and a byte order mark', () => {
    const parsed = parseCsv('\uFEFFname,city\r\nBandra,Mumbai\r\n');
    expect(parsed.headers).toEqual(['name', 'city']);
    expect(parsed.rows).toEqual([['Bandra', 'Mumbai']]);
  });

  it('skips blank lines', () => {
    const parsed = parseCsv('name\nA\n\n\nB\n');
    expect(parsed.rows).toEqual([['A'], ['B']]);
  });

  it('reports an unterminated quote', () => {
    expect(parseCsv('name\n"unclosed\n').errors[0]).toMatch(/never closed/i);
  });
});

describe('previewImport', () => {
  it('maps alias columns onto outlet fields', () => {
    const parsed = parseCsv('store,pin,mobile,city\nIndiranagar,560038,9876543210,Bengaluru\n');
    const preview = previewImport(parsed);
    expect(preview.issues).toEqual([]);
    expect(preview.valid[0].value.postal_code).toBe('560038');
    expect(preview.valid[0].value.phone).toBe('9876543210');
    expect(preview.valid[0].value.name).toBe('Indiranagar');
  });

  it('explains a missing name column instead of failing silently', () => {
    const preview = previewImport(parseCsv('city,pin\nBengaluru,560038\n'));
    expect(preview.valid).toEqual([]);
    expect(preview.issues[0].message).toMatch(/needs a column called name/i);
  });

  it('collects validation issues with spreadsheet row numbers', () => {
    const preview = previewImport(parseCsv('name,pin,phone\nGood,560038,9876543210\nBad,123,999\n'));
    expect(preview.valid).toHaveLength(1);
    const rows = preview.issues.map((issue) => issue.row);
    expect(rows).toContain(3);
    expect(preview.issues.some((issue) => issue.field === 'postal_code')).toBe(true);
    expect(preview.issues.some((issue) => issue.field === 'phone')).toBe(true);
  });

  it('flags duplicates inside the same file but still imports them', () => {
    const preview = previewImport(parseCsv('name,city\nBandra,Mumbai\nBandra,Mumbai\n'));
    expect(preview.valid).toHaveLength(2);
    expect(preview.duplicatesInFile).toHaveLength(1);
    expect(preview.duplicatesInFile[0]).toMatch(/repeats/i);
  });

  it('parses the bundled sample cleanly', () => {
    const preview = previewImport(parseCsv(SAMPLE_CSV));
    expect(preview.total).toBe(3);
    expect(preview.valid).toHaveLength(3);
    expect(preview.issues).toEqual([]);
  });
});
