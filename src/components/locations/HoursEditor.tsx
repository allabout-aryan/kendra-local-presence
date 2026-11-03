'use client';

import * as React from 'react';
import type { BusinessHours, Weekday } from '@/lib/domain/types';
import { WEEKDAYS, WEEKDAY_LABEL, hoursSummary } from '@/lib/domain/hours';
import { Input } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export function HoursEditor({
  value,
  onChange,
  compact,
}: {
  value: BusinessHours;
  onChange: (next: BusinessHours) => void;
  compact?: boolean;
}) {
  const setDay = (day: Weekday, slot: BusinessHours[Weekday]) => {
    onChange({ ...value, [day]: slot });
  };

  return (
    <div className="space-y-2">
      <div className={cn('divide-y divide-ink-100 rounded-lg border border-ink-200', compact && 'text-[12px]')}>
        {WEEKDAYS.map((day) => {
          const slot = value[day];
          const closed = slot === null;
          return (
            <div key={day} className="flex items-center gap-2 px-2.5 py-1.5">
              <span className="w-[70px] shrink-0 text-[12px] text-ink-700">{WEEKDAY_LABEL[day]}</span>
              {closed ? (
                <span className="flex-1 text-[12px] text-ink-400">Closed</span>
              ) : (
                <div className="flex flex-1 items-center gap-1.5">
                  <Input
                    type="time"
                    aria-label={`${WEEKDAY_LABEL[day]} opening time`}
                    value={slot?.open ?? ''}
                    onChange={(event) => setDay(day, { open: event.target.value, close: slot?.close ?? '21:00' })}
                    className="h-7 w-[104px] px-1.5 text-[12px]"
                  />
                  <span className="text-[11px] text-ink-400">to</span>
                  <Input
                    type="time"
                    aria-label={`${WEEKDAY_LABEL[day]} closing time`}
                    value={slot?.close ?? ''}
                    onChange={(event) => setDay(day, { open: slot?.open ?? '09:00', close: event.target.value })}
                    className="h-7 w-[104px] px-1.5 text-[12px]"
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => setDay(day, closed ? { open: '09:00', close: '21:00' } : null)}
                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              >
                {closed ? 'Open' : 'Close'}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-400">{hoursSummary(value)}</p>
    </div>
  );
}

export function defaultHours(): BusinessHours {
  return WEEKDAYS.reduce<BusinessHours>((acc, day) => {
    acc[day] = { open: '09:00', close: '21:00' };
    return acc;
  }, {});
}
