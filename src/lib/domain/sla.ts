import type { Review } from './types';

export const SLA_HOURS = 48;

export function responseHours(review: Pick<Review, 'published_at' | 'replied_at'>): number | null {
  if (!review.replied_at) return null;
  const published = new Date(review.published_at).getTime();
  const replied = new Date(review.replied_at).getTime();
  if (Number.isNaN(published) || Number.isNaN(replied)) return null;
  return Math.max(0, (replied - published) / 3_600_000);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function ageHours(review: Pick<Review, 'published_at'>, now = new Date()): number {
  const published = new Date(review.published_at).getTime();
  if (Number.isNaN(published)) return 0;
  return Math.max(0, (now.getTime() - published) / 3_600_000);
}

export function isOverdue(review: Pick<Review, 'published_at' | 'replied_at' | 'status'>, now = new Date()): boolean {
  if (review.replied_at || review.status === 'replied' || review.status === 'ignored') return false;
  return ageHours(review, now) > SLA_HOURS;
}

export interface SlaSummary {
  answered: number;
  open: number;
  overdue: number;
  medianHours: number | null;
  withinSla: number;
  withinSlaPct: number | null;
  slowestHours: number | null;
}

export function summariseSla(reviews: Review[], now = new Date()): SlaSummary {
  const answered = reviews.filter((review) => review.replied_at || review.status === 'replied');
  const open = reviews.filter((review) => !review.replied_at && review.status !== 'replied' && review.status !== 'ignored');
  const times = answered.map(responseHours).filter((value): value is number => value !== null);
  const withinSla = times.filter((hours) => hours <= SLA_HOURS).length;

  return {
    answered: answered.length,
    open: open.length,
    overdue: open.filter((review) => isOverdue(review, now)).length,
    medianHours: median(times),
    withinSla,
    withinSlaPct: times.length ? (withinSla / times.length) * 100 : null,
    slowestHours: times.length ? Math.max(...times) : null,
  };
}

export function formatDuration(hours: number | null): string {
  if (hours === null || Number.isNaN(hours)) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  // Hours read better than fractions of a day until roughly two days.
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}
