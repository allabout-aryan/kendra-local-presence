const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrPrecise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const plain = new Intl.NumberFormat('en-IN');

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return plain.format(Math.round(value));
}

/** Indian short-scale: 1.2L, 4.5Cr — the way ops teams in India read numbers. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `${trimZero(value / 1_00_00_000)}Cr`;
  if (abs >= 1_00_000) return `${trimZero(value / 1_00_000)}L`;
  if (abs >= 1_000) return `${trimZero(value / 1_000)}k`;
  return formatNumber(value);
}

function trimZero(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatCurrency(value: number, precise = false): string {
  if (Number.isNaN(value)) return '—';
  return precise ? inrPrecise.format(value) : inr.format(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDayMonth(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

export function formatPercent(value: number | null, digits = 0): string {
  if (value === null || Number.isNaN(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '··';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
