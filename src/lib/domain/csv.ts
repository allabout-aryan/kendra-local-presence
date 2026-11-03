export type CsvValue = string | number | boolean | null | undefined;

const NEEDS_QUOTING = /[",\n\r]/;

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Guard against CSV injection in spreadsheet apps: a leading =, +, -, @ is
  // interpreted as a formula. Prefixing with a tab keeps the data readable.
  const safe = /^[=+\-@\t\r]/.test(text) ? `\t${text}` : text;
  return NEEDS_QUOTING.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(cell).join(',')];
  for (const row of rows) lines.push(row.map(cell).join(','));
  return `${lines.join('\n')}\n`;
}

export function csvFilename(prefix: string, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  return `${prefix}-${stamp}.csv`;
}

export function downloadCsv(filename: string, content: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
