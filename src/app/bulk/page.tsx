'use client';

import * as React from 'react';
import { CheckCircle2, ClipboardList, Clock, Search, TriangleAlert, XCircle } from 'lucide-react';
import { AppShell, PageGuard } from '@/components/shell/AppShell';
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/overlay';
import { HoursEditor, defaultHours } from '@/components/locations/HoursEditor';
import { useStore } from '@/lib/data/store';
import { can } from '@/lib/domain/permissions';
import { bulkEditSchema, firstError } from '@/lib/domain/validation';
import { formatRelative } from '@/lib/domain/format';
import { cn } from '@/lib/utils';
import type { BulkJob, JobKind } from '@/lib/domain/types';
import type { BusinessHours } from '@/lib/domain/types';

const KINDS: { value: JobKind; label: string; description: string }[] = [
  { value: 'hours', label: 'Opening hours', description: 'Set or override hours, optionally skipping days already marked closed.' },
  { value: 'description', label: 'Description', description: 'Replace the business description on every selected outlet.' },
  { value: 'attributes', label: 'Attributes', description: 'Toggle amenities such as wheelchair access or outdoor seating.' },
  { value: 'sync', label: 'Re-sync', description: 'Pull the latest profile data from Google for the selected outlets.' },
];

const ATTRIBUTE_OPTIONS = [
  { key: 'wheelchair_accessible', label: 'Wheelchair accessible' },
  { key: 'outdoor_seating', label: 'Outdoor seating' },
  { key: 'wifi', label: 'Free Wi-Fi' },
  { key: 'card_payments', label: 'Card payments' },
  { key: 'parking', label: 'Parking available' },
];

function JobRow({ job }: { job: BulkJob }) {
  const tone = job.status === 'succeeded' ? 'positive' : job.status === 'failed' ? 'danger' : 'warning';
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-2.5">
      <span className="text-ink-400">
        {job.status === 'succeeded' ? <CheckCircle2 className="h-4 w-4 text-pine-600" /> : job.status === 'failed' ? <XCircle className="h-4 w-4 text-brick-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium capitalize text-ink-900">Bulk {job.kind}</p>
        <p className="text-[11px] text-ink-400">
          {formatRelative(job.created_at)} · {job.succeeded}/{job.total} succeeded
          {job.failed > 0 ? ` · ${job.failed} failed` : ''}
        </p>
        {job.error && <p className="mt-0.5 line-clamp-1 text-[11px] text-brick-600">{job.error}</p>}
      </div>
      <Badge tone={tone}>{job.status}</Badge>
    </li>
  );
}

function BulkInner() {
  const { data, role, bulkEdit } = useStore();
  const jobs = data.jobs;
  const { push } = useToast();
  const [kind, setKind] = React.useState<JobKind>('hours');
  const [selected, setSelected] = React.useState<string[]>([]);
  const [query, setQuery] = React.useState('');
  const [hours, setHours] = React.useState<BusinessHours>(defaultHours());
  const [description, setDescription] = React.useState('');
  const [attributes, setAttributes] = React.useState<Record<string, boolean>>({});
  const [keepClosed, setKeepClosed] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastJob, setLastJob] = React.useState<BulkJob | null>(null);

  React.useEffect(() => {
    const ids = new URLSearchParams(window.location.search).get('ids');
    if (ids) setSelected(ids.split(',').filter(Boolean));
  }, []);

  const canRun = can(role, 'bulk:run');
  const visible = data.locations.filter((location) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return location.name.toLowerCase().includes(needle) || (location.city ?? '').toLowerCase().includes(needle);
  });

  const run = async () => {
    setError(null);
    const payload = {
      kind,
      locationIds: selected,
      hours: kind === 'hours' ? hours : undefined,
      description: kind === 'description' ? description : undefined,
      attributes: kind === 'attributes' ? attributes : undefined,
      keepClosedDays: keepClosed,
    };
    const parsed = bulkEditSchema.safeParse(payload);
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setBusy(true);
    try {
      const job = await bulkEdit(parsed.data);
      setLastJob(job);
      push({
        tone: job.failed > 0 ? 'error' : 'success',
        title: job.failed > 0 ? 'Finished with errors' : 'Bulk edit applied',
        description: `${job.succeeded} of ${job.total} outlets updated${job.failed ? `, ${job.failed} failed` : ''}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The bulk job failed';
      setError(message);
      push({ tone: 'error', title: 'Bulk edit failed', description: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Bulk edit" subtitle="Change many outlets at once, with a per-outlet result">
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader title="1 · Choose outlets" description={`${selected.length} of ${data.locations.length} selected`} />
          <div className="space-y-2 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" aria-hidden />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter outlets" aria-label="Filter outlets" className="pl-8" />
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Button size="sm" variant="ghost" onClick={() => setSelected(visible.map((l) => l.id))}>Select all</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
            </div>
            <ul className="max-h-[420px] space-y-0.5 overflow-y-auto">
              {visible.map((location) => (
                <li key={location.id}>
                  <Checkbox
                    checked={selected.includes(location.id)}
                    onChange={(checked) =>
                      setSelected(checked ? [...selected, location.id] : selected.filter((id) => id !== location.id))
                    }
                    label={
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{location.name}</span>
                        <span className="text-[10px] text-ink-400">{location.city}</span>
                      </span>
                    }
                    className="rounded-md px-1.5 py-1 hover:bg-ink-50"
                  />
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="2 · Choose what to change" />
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {KINDS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setKind(option.value)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    kind === option.value ? 'border-pine-600 bg-pine-50/50 ring-1 ring-pine-600/20' : 'border-ink-200 hover:border-ink-300',
                  )}
                  aria-pressed={kind === option.value}
                >
                  <p className="text-[13px] font-medium text-ink-900">{option.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{option.description}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="3 · Configure" description={KINDS.find((option) => option.value === kind)?.description} />
            <div className="space-y-3 p-3">
              {kind === 'hours' && (
                <>
                  <HoursEditor value={hours} onChange={setHours} />
                  <Checkbox
                    checked={keepClosed}
                    onChange={setKeepClosed}
                    label="Skip outlets that are marked closed on a day"
                    description="Useful for outlets with a weekly off — their closed day stays closed."
                  />
                </>
              )}

              {kind === 'description' && (
                <Field label="New description" hint={`${description.length}/750 characters · aim for 250+ with the category and locality`}>
                  <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="A neighbourhood roastery serving single-origin espresso and fresh bakes…" />
                </Field>
              )}

              {kind === 'attributes' && (
                <div className="space-y-1.5">
                  {ATTRIBUTE_OPTIONS.map((option) => (
                    <Checkbox
                      key={option.key}
                      checked={Boolean(attributes[option.key])}
                      onChange={(checked) => setAttributes({ ...attributes, [option.key]: checked })}
                      label={option.label}
                    />
                  ))}
                </div>
              )}

              {kind === 'sync' && (
                <p className="rounded-lg bg-ink-50 px-3 py-2 text-[12px] leading-relaxed text-ink-600">
                  Re-sync refreshes profile data and clears the pending-sync flag. It does not write anything to Google.
                </p>
              )}

              {error && (
                <p className="flex items-start gap-2 rounded-lg bg-brick-50 px-3 py-2 text-[12px] text-brick-700" role="alert">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
                <p className="text-[11px] text-ink-400">
                  Applies to {selected.length} outlet{selected.length === 1 ? '' : 's'}
                </p>
                <Button variant="primary" onClick={run} loading={busy} disabled={!canRun || selected.length === 0}>
                  Run bulk edit
                </Button>
              </div>
              {!canRun && <p className="text-[11px] text-amber-700">Your role is read-only — ask an admin for member access.</p>}
            </div>
          </Card>

          {lastJob && (
            <Card>
              <CardHeader
                title="Last run"
                description={`${lastJob.succeeded} succeeded · ${lastJob.failed} failed`}
                action={<Badge tone={lastJob.failed > 0 ? 'danger' : 'positive'}>{lastJob.status}</Badge>}
              />
              {lastJob.error && <p className="px-4 py-2 text-[12px] text-brick-700">{lastJob.error}</p>}
            </Card>
          )}

          <Card>
            <CardHeader title="Recent jobs" description="Every bulk operation is recorded with its result" />
            {jobs.length === 0 ? (
              <EmptyState icon={<ClipboardList className="h-4.5 w-4.5" />} title="No bulk jobs yet" description="Run your first edit above — the result will appear here." />
            ) : (
              <ul className="divide-y divide-ink-100">
                {jobs.slice(0, 8).map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default function BulkPage() {
  return (
    <PageGuard>
      <BulkInner />
    </PageGuard>
  );
}
