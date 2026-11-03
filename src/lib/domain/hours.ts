import type { BusinessHours, Weekday } from './types';

export const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};
const SHORT: Record<Weekday, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME.test(value);
}

/** Never trust a jsonb blob from the wire: normalise to known weekdays only. */
export function normalizeHours(input: unknown): BusinessHours {
  const out: BusinessHours = {};
  if (!input || typeof input !== 'object') return out;
  const raw = input as Record<string, unknown>;
  for (const day of WEEKDAYS) {
    const value = raw[day];
    if (value === null) {
      out[day] = null;
      continue;
    }
    if (value && typeof value === 'object') {
      const { open, close } = value as { open?: unknown; close?: unknown };
      if (typeof open === 'string' && typeof close === 'string' && isValidTime(open) && isValidTime(close)) {
        out[day] = { open, close };
      }
    }
  }
  return out;
}

export function missingDays(hours: BusinessHours): Weekday[] {
  return WEEKDAYS.filter((day) => hours[day] === undefined);
}

export function openDays(hours: BusinessHours): Weekday[] {
  return WEEKDAYS.filter((day) => hours[day] !== undefined && hours[day] !== null);
}

function to12h(time: string): string {
  const [hStr, mStr] = time.split(':');
  const hour = Number(hStr);
  const suffix = hour >= 12 ? 'pm' : 'am';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${mStr === '00' ? '' : `:${mStr}`}${suffix}`;
}

/** "Mon–Fri 10am–9pm · Sat 11am–8pm · Sun closed" — grouped for scanning, not for machines. */
export function hoursSummary(hours: BusinessHours): string {
  const groups: { days: Weekday[]; label: string }[] = [];
  for (const day of WEEKDAYS) {
    const slot = hours[day];
    const label = slot === null ? 'closed' : slot === undefined ? 'unknown' : `${to12h(slot.open)}–${to12h(slot.close)}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.days.push(day);
    else groups.push({ days: [day], label });
  }
  return groups
    .map(({ days, label }) => {
      const span = days.length > 1
        ? `${SHORT[days[0]]}–${SHORT[days[days.length - 1]]}`
        : days.map((d) => SHORT[d]).join(', ');
      return `${span} ${label}`;
    })
    .join(' · ');
}

/** Merges a template over a location's hours, optionally skipping closed days. */
export function applyHoursPatch(current: BusinessHours, patch: BusinessHours, keepClosed = true): BusinessHours {
  const next: BusinessHours = { ...current };
  for (const day of WEEKDAYS) {
    const value = patch[day];
    if (value === undefined) continue;
    if (keepClosed && current[day] === null) continue;
    next[day] = value;
  }
  return next;
}

export function hasHoursGap(hours: BusinessHours): boolean {
  return missingDays(hours).length > 0;
}

export function totalWeeklyHours(hours: BusinessHours): number {
  return openDays(hours).reduce((total, day) => {
    const slot = hours[day];
    if (!slot) return total;
    const [oh, om] = slot.open.split(':').map(Number);
    const [ch, cm] = slot.close.split(':').map(Number);
    const minutes = ch * 60 + cm - (oh * 60 + om);
    return total + Math.max(0, minutes) / 60;
  }, 0);
}
