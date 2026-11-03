'use client';

import * as React from 'react';
import { Activity, Building2, ClipboardList, MessageSquareText, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import { AppShell, PageGuard } from '@/components/shell/AppShell';
import { Card, CardHeader, EmptyState, Select } from '@/components/ui/primitives';
import { useStore } from '@/lib/data/store';
import { formatDate, formatRelative } from '@/lib/domain/format';

const ICONS: Record<string, React.ElementType> = {
  'org.created': Building2,
  'location.created': Building2,
  'location.updated': Building2,
  'review.replied': MessageSquareText,
  'sync.completed': RefreshCw,
  'audit.flagged': ShieldCheck,
  'member.added': UserPlus,
  'member.removed': UserPlus,
  'report.exported': ClipboardList,
};

function ActivityInner() {
  const { data } = useStore();
  const [kind, setKind] = React.useState('all');

  const filtered = data.activity.filter((event) => kind === 'all' || event.kind.startsWith(kind));

  const groups = React.useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const event of filtered) {
      const day = event.created_at.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), event]);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <AppShell
      title="Activity"
      subtitle="Everything that changed, and who changed it"
      actions={
        <Select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Filter activity" className="w-auto">
          <option value="all">All activity</option>
          <option value="location">Outlets</option>
          <option value="review">Reviews</option>
          <option value="bulk">Bulk edits</option>
          <option value="sync">Syncs</option>
          <option value="member">Team</option>
        </Select>
      }
    >
      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Activity className="h-4.5 w-4.5" />}
            title="Nothing recorded yet"
            description="Editing an outlet, replying to a review or running a bulk job will show up here."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([day, events]) => (
            <Card key={day}>
              <CardHeader title={formatDate(day)} description={`${events.length} event${events.length === 1 ? '' : 's'}`} />
              <ul className="divide-y divide-ink-100">
                {events.map((event) => {
                  const Icon = ICONS[event.kind] ?? Activity;
                  return (
                    <li key={event.id} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-50 text-ink-500 ring-1 ring-inset ring-ink-200">
                        <Icon className="h-3 w-3" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-ink-800">{event.summary}</p>
                        <p className="text-[11px] text-ink-400">
                          {event.kind} · {formatRelative(event.created_at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export default function ActivityPage() {
  return (
    <PageGuard>
      <ActivityInner />
    </PageGuard>
  );
}
