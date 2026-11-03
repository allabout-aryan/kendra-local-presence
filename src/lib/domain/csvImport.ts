import type { LocationInput } from './validation';
import { locationSchema } from './validation';

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  errors: string[];
}

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF, and a BOM. */
export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^\uFEFF/, '');
  const errors: string[] = [];
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (inQuotes) errors.push('A quoted value was never closed — check for a stray double quote.');
  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);

  const [headerRow = [], ...body] = rows;
  const headers = headerRow.map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));

  return { headers, rows: body, errors };
}

export interface ImportIssue {
  row: number;
  field: string;
  message: string;
}

export interface ImportPreview {
  total: number;
  valid: { row: number; value: LocationInput; label: string }[];
  issues: ImportIssue[];
  duplicatesInFile: string[];
}

const REQUIRED = ['name'];

/** Column aliases so an export from Google Sheets or a store list just works. */
const ALIASES: Record<string, string> = {
  outlet: 'name',
  outlet_name: 'name',
  store: 'name',
  store_name: 'name',
  location: 'name',
  location_name: 'name',
  code: 'store_code',
  store_code: 'store_code',
  store_id: 'store_code',
  pin: 'postal_code',
  pin_code: 'postal_code',
  postal: 'postal_code',
  postcode: 'postal_code',
  zip: 'postal_code',
  address: 'address_line1',
  street: 'address_line1',
  address_line_1: 'address_line1',
  category: 'primary_category',
  primary_category: 'primary_category',
  mobile: 'phone',
  phone_number: 'phone',
  tel: 'phone',
  url: 'website',
  site: 'website',
};

export function previewImport(parsed: ParsedCsv): ImportPreview {
  const index = new Map<string, number>();
  parsed.headers.forEach((header, position) => {
    index.set(ALIASES[header] ?? header, position);
  });

  const missing = REQUIRED.filter((column) => !index.has(column));
  if (missing.length > 0) {
    return {
      total: parsed.rows.length,
      valid: [],
      issues: [
        {
          row: 0,
          field: missing.join(', '),
          message: `The file needs a column called ${missing.join(' or ')} (or one of: outlet, store, location).`,
        },
      ],
      duplicatesInFile: [],
    };
  }

  const valid: ImportPreview['valid'] = [];
  const issues: ImportIssue[] = [];
  const seen = new Map<string, number>();
  const duplicatesInFile: string[] = [];

  const cell = (row: string[], column: string): string => {
    const position = index.get(column);
    if (position === undefined) return '';
    return row[position] ?? '';
  };

  parsed.rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2; // header is line 1
    const candidate = {
      name: cell(row, 'name'),
      store_code: cell(row, 'store_code'),
      city: cell(row, 'city'),
      state: cell(row, 'state'),
      postal_code: cell(row, 'postal_code'),
      address_line1: cell(row, 'address_line1'),
      phone: cell(row, 'phone'),
      website: cell(row, 'website'),
      primary_category: cell(row, 'primary_category'),
      description: cell(row, 'description'),
      status: (cell(row, 'status') || 'active') as LocationInput['status'],
    };

    const parsedRow = locationSchema.safeParse(candidate);
    if (!parsedRow.success) {
      for (const issue of parsedRow.error.issues) {
        issues.push({
          row: rowNumber,
          field: issue.path.join('.') || 'row',
          message: issue.message,
        });
      }
      return;
    }

    const key = `${parsedRow.data.name.toLowerCase()}|${(parsedRow.data.city ?? '').toLowerCase()}`;
    const previous = seen.get(key);
    if (previous !== undefined) {
      duplicatesInFile.push(`Row ${rowNumber} repeats "${parsedRow.data.name}" from row ${previous}.`);
    } else {
      seen.set(key, rowNumber);
    }

    valid.push({ row: rowNumber, value: parsedRow.data, label: parsedRow.data.name });
  });

  return { total: parsed.rows.length, valid, issues, duplicatesInFile };
}

export const SAMPLE_CSV = `outlet,code,city,state,pin,phone,category
Indiranagar,BLR-01,Bengaluru,Karnataka,560038,9876543210,Coffee shop
Bandra West,BOM-01,Mumbai,Maharashtra,400050,9876543211,Coffee shop
Koregaon Park,PNQ-01,Pune,Maharashtra,411001,9876543212,Cafe`;
