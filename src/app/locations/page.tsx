'use client';

import * as React from 'react';
import {
  Building2, Download, ExternalLink, Pencil, Plus, Save, Search, Star, Trash2, Upload, X,
} from 'lucide-react';
import { AppShell, PageGuard } from '@/components/shell/AppShell';
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, Select, Skeleton, Textarea,
} from '@/components/ui/primitives';
import { ConfirmDialog, Drawer, Modal, useToast } from '@/components/ui/overlay';
import { ScoreRing, Sparkline } from '@/components/ui/charts';
import { Pagination, TableWrap, Td, Th, THead, Tr } from '@/components/ui/table';
import { HoursEditor, defaultHours } from '@/components/locations/HoursEditor';
import { ImportDialog } from '@/components/locations/ImportDialog';
import { DuplicatePanel } from '@/components/locations/DuplicatePanel';
import { useSavedViews } from '@/lib/data/savedViews';
import { useAuditResults, useStore } from '@/lib/data/store';
import { can } from '@/lib/domain/permissions';
import { fieldErrors, firstError, locationSchema, type LocationInput } from '@/lib/domain/validation';
import { formatCompact, formatDate, formatRelative } from '@/lib/domain/format';
import { hoursSummary } from '@/lib/domain/hours';
import { csvFilename, downloadCsv, toCsv } from '@/lib/domain/csv';
import { sum } from '@/lib/domain/kpis';
import { cn } from '@/lib/utils';
import type { Location } from '@/lib/domain/types';

const PAGE_SIZE = 12;

const BLANK: LocationInput = {
  name: '',
  store_code: '',
  city: '',
  state: '',
  postal_code: '',
  address_line1: '',
  phone: '',
  website: '',
  primary_category: '',
  description: '',
  status: 'active',
};

function LocationsInner() {
  const { data, role, saveLocation, deleteLocation, mode } = useStore();
  const audits = useAuditResults();
  const { push } = useToast();

  const [query, setQuery] = React.useState('');
  const [city, setCity] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [sort, setSort] = React.useState<'score' | 'name' | 'reviews'>('score');
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [drawerId, setDrawerId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<Location | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<LocationInput>(BLANK);
  const [formHours, setFormHours] = React.useState(defaultHours());
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<Location | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const views = useSavedViews<{ query: string; city: string; statusFilter: string; sort: string }>('outlets');

  // deep link: /locations?outlet=<id> without pulling in useSearchParams
  React.useEffect(() => {
    const outlet = new URLSearchParams(window.location.search).get('outlet');
    if (outlet) setDrawerId(outlet);
  }, []);

  const rows = React.useMemo(() => {
    return audits
      .map(({ location, result }) => {
        const reviews = data.reviews.filter((review) => review.location_id === location.id);
        const rated = reviews.filter((review) => review.rating > 0);
        const metrics = data.metrics.filter((m) => m.location_id === location.id);
        return {
          location,
          score: result.score,
          topFix: result.topFix,
          findings: result.findings,
          openReviews: reviews.filter((r) => r.status === 'new' || r.status === 'drafted' || r.status === 'escalated').length,
          avgRating: rated.length ? rated.reduce((total, review) => total + review.rating, 0) / rated.length : 0,
          totalReviews: reviews.length,
          calls: sum(metrics, (m) => m.calls),
          directions: sum(metrics, (m) => m.direction_requests),
          spark: metrics.sort((a, b) => a.captured_on.localeCompare(b.captured_on)).map((m) => m.views),
        };
      })
      .filter((row) => {
        if (city !== 'all' && row.location.city !== city) return false;
        if (statusFilter !== 'all' && row.location.status !== statusFilter) return false;
        if (!query.trim()) return true;
        const needle = query.trim().toLowerCase();
        return (
          row.location.name.toLowerCase().includes(needle) ||
          (row.location.city ?? '').toLowerCase().includes(needle) ||
          (row.location.store_code ?? '').toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        if (sort === 'name') return a.location.name.localeCompare(b.location.name);
        if (sort === 'reviews') return b.openReviews - a.openReviews;
        return a.score - b.score;
      });
  }, [audits, data.reviews, data.metrics, query, city, statusFilter, sort]);

  const cities = React.useMemo(
    () => Array.from(new Set(data.locations.map((location) => location.city).filter(Boolean))) as string[],
    [data.locations],
  );

  const paged = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const drawerRow = rows.find((row) => row.location.id === drawerId) ?? null;
  const canWrite = can(role, 'location:create');
  const canDelete = can(role, 'location:delete');

  const openEdit = (location: Location) => {
    setEditing(location);
    setForm({
      name: location.name,
      store_code: location.store_code ?? '',
      city: location.city ?? '',
      state: location.state ?? '',
      postal_code: location.postal_code ?? '',
      address_line1: location.address_line1 ?? '',
      phone: location.phone ?? '',
      website: location.website ?? '',
      primary_category: location.primary_category ?? '',
      description: location.description ?? '',
      status: location.status,
    });
    setFormHours(location.hours ?? defaultHours());
    setErrors({});
  };

  const submitForm = async () => {
    const parsed = locationSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    try {
      await saveLocation({ ...parsed.data, hours: formHours }, editing?.id);
      push({ tone: 'success', title: editing ? 'Outlet updated' : 'Outlet added' });
      setEditing(null);
      setCreating(false);
      setErrors({});
    } catch (error) {
      push({ tone: 'error', title: 'Could not save', description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const csv = toCsv(
      ['Outlet', 'Code', 'City', 'State', 'Status', 'Audit score', 'Rating', 'Open reviews', 'Calls 30d', 'Directions 30d', 'Last synced'],
      rows.map((row) => [
        row.location.name,
        row.location.store_code ?? '',
        row.location.city ?? '',
        row.location.state ?? '',
        row.location.status,
        row.score,
        row.avgRating.toFixed(2),
        row.openReviews,
        row.calls,
        row.directions,
        row.location.last_synced_at ?? '',
      ]),
    );
    downloadCsv(csvFilename('kendra-outlets'), csv);
    push({ tone: 'success', title: 'Export ready', description: `${rows.length} outlets written to CSV.` });
  };

  const formModal = (
    <Modal
      open={creating || Boolean(editing)}
      onClose={() => {
        setCreating(false);
        setEditing(null);
      }}
      title={editing ? `Edit ${editing.name}` : 'Add an outlet'}
      description={editing ? 'Changes are written to the profile and logged in activity.' : 'Create the outlet record first; Google sync fills in the profile IDs.'}
      width="lg"
      footer={
        <>
          <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={busy} onClick={submitForm}>
            {editing ? 'Save changes' : 'Add outlet'}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Outlet name" required error={errors.name} htmlFor="loc-name">
          <Input id="loc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Indiranagar" invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Store code" error={errors.store_code} htmlFor="loc-code" hint="Used to match bulk edits and reports.">
          <Input id="loc-code" value={form.store_code} onChange={(e) => setForm({ ...form, store_code: e.target.value })} placeholder="BLR-01" />
        </Field>
        <Field label="City" error={errors.city} htmlFor="loc-city">
          <Input id="loc-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Bengaluru" />
        </Field>
        <Field label="State" error={errors.state} htmlFor="loc-state">
          <Input id="loc-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="Karnataka" />
        </Field>
        <Field label="PIN code" error={errors.postal_code} htmlFor="loc-pin">
          <Input id="loc-pin" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} placeholder="560038" inputMode="numeric" invalid={Boolean(errors.postal_code)} />
        </Field>
        <Field label="Phone" error={errors.phone} htmlFor="loc-phone">
          <Input id="loc-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" inputMode="tel" invalid={Boolean(errors.phone)} />
        </Field>
        <Field label="Street address" error={errors.address_line1} htmlFor="loc-address" className="sm:col-span-2">
          <Input id="loc-address" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} placeholder="12, 100 Feet Road" />
        </Field>
        <Field label="Website" error={errors.website} htmlFor="loc-web">
          <Input id="loc-web" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://brand.com/indiranagar" invalid={Boolean(errors.website)} />
        </Field>
        <Field label="Primary category" error={errors.primary_category} htmlFor="loc-cat">
          <Input id="loc-cat" value={form.primary_category} onChange={(e) => setForm({ ...form, primary_category: e.target.value })} placeholder="Coffee shop" />
        </Field>
        <Field label="Description" error={errors.description} htmlFor="loc-desc" className="sm:col-span-2" hint={`${(form.description ?? '').length}/750 characters · aim for 250+`}>
          <Textarea id="loc-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs font-medium text-ink-700">Opening hours</p>
          <HoursEditor value={formHours} onChange={setFormHours} />
        </div>
      </div>
    </Modal>
  );

  return (
    <AppShell
      title="Outlets"
      subtitle={`${data.locations.length} locations in ${cities.length} cities`}
      actions={
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)} icon={<Upload className="h-3.5 w-3.5" />}>
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={exportCsv} icon={<Download className="h-3.5 w-3.5" />}>
            <span className="hidden sm:inline">Export</span>
          </Button>
          {canWrite && (
            <Button size="sm" variant="primary" onClick={() => { setCreating(true); setForm(BLANK); setFormHours(defaultHours()); setErrors({}); }} icon={<Plus className="h-3.5 w-3.5" />}>
              Add outlet
            </Button>
          )}
        </div>
      }
    >
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-3 py-2.5">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" aria-hidden />
            <Input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(0); }}
              placeholder="Search outlets, city or store code"
              aria-label="Search outlets"
              className="pl-8"
            />
          </div>
          <Select value={city} onChange={(event) => { setCity(event.target.value); setPage(0); }} aria-label="Filter by city" className="w-auto">
            <option value="all">All cities</option>
            {cities.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
          <Select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }} aria-label="Filter by status" className="w-auto">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="pending_sync">Pending sync</option>
            <option value="disconnected">Disconnected</option>
          </Select>
          <Select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort outlets" className="w-auto">
            <option value="score">Worst score first</option>
            <option value="name">Name A–Z</option>
            <option value="reviews">Most open reviews</option>
          </Select>
          {(query || city !== 'all' || statusFilter !== 'all') && (
            <Button size="sm" variant="ghost" onClick={() => { setQuery(''); setCity('all'); setStatusFilter('all'); }} icon={<X className="h-3.5 w-3.5" />}>
              Clear
            </Button>
          )}
        </div>

        {(views.views.length > 0 || query || city !== 'all' || statusFilter !== 'all') && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-200 px-3 py-1.5">
            <span className="label-caps">Saved views</span>
            {views.views.map((view) => (
              <button
                key={view.id}
                onClick={() => {
                  setQuery(view.payload.query);
                  setCity(view.payload.city);
                  setStatusFilter(view.payload.statusFilter);
                  setSort(view.payload.sort as typeof sort);
                  setPage(0);
                }}
                className="group flex items-center gap-1 rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-[11px] text-ink-600 hover:border-ink-300 hover:text-ink-900"
              >
                {view.name}
                <X
                  className="h-2.5 w-2.5 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    views.remove(view.id);
                  }}
                />
              </button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const name = window.prompt('Name this view');
                if (name) views.save(name, { query, city, statusFilter, sort });
              }}
              icon={<Save className="h-3 w-3" />}
            >
              Save view
            </Button>
          </div>
        )}

        {selected.length > 0 && (
          <div className="flex items-center gap-2 border-b border-ink-200 bg-pine-50/60 px-3 py-2 text-[12px]">
            <span className="font-medium text-pine-700">{selected.length} selected</span>
            <Button size="sm" variant="secondary" onClick={() => { window.location.href = `/bulk?ids=${selected.join(',')}`; }}>
              Bulk edit selection
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>Clear</Button>
          </div>
        )}

        {rows.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-4.5 w-4.5" />}
            title={data.locations.length === 0 ? 'No outlets yet' : 'No outlets match those filters'}
            description={
              data.locations.length === 0
                ? 'Add your first outlet, or connect Google Business Profile to import every location automatically.'
                : 'Try a different search term, city or status.'
            }
            action={
              data.locations.length === 0 && canWrite ? (
                <Button variant="primary" onClick={() => { setCreating(true); setForm(BLANK); }}>Add an outlet</Button>
              ) : undefined
            }
          />
        ) : (
          <TableWrap>
            <THead>
              <Th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Select all outlets on this page"
                  checked={paged.length > 0 && paged.every((row) => selected.includes(row.location.id))}
                  onChange={(event) => {
                    const ids = paged.map((row) => row.location.id);
                    setSelected(event.target.checked ? Array.from(new Set([...selected, ...ids])) : selected.filter((id) => !ids.includes(id)));
                  }}
                  className="h-3.5 w-3.5 rounded border-ink-300 text-pine-600"
                />
              </Th>
              <Th>Outlet</Th>
              <Th align="right">Audit</Th>
              <Th align="right">Rating</Th>
              <Th align="right">Reviews</Th>
              <Th align="right">Calls 30d</Th>
              <Th>Trend</Th>
              <Th>Synced</Th>
              <Th className="w-8" />
            </THead>
            <tbody>
              {paged.map((row) => (
                <Tr key={row.location.id} onClick={() => setDrawerId(row.location.id)}>
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.location.name}`}
                      checked={selected.includes(row.location.id)}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        setSelected(event.target.checked ? [...selected, row.location.id] : selected.filter((id) => id !== row.location.id))
                      }
                      className="h-3.5 w-3.5 rounded border-ink-300 text-pine-600"
                    />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ink-100 text-[10px] font-semibold text-ink-600">
                        {row.location.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink-900">{row.location.name}</p>
                        <p className="truncate text-[11px] text-ink-400">
                          {row.location.city} {row.location.store_code ? `· ${row.location.store_code}` : ''}
                        </p>
                      </div>
                      {row.location.status !== 'active' && (
                        <Badge tone={row.location.status === 'paused' ? 'neutral' : 'warning'}>{row.location.status.replace('_', ' ')}</Badge>
                      )}
                    </div>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span
                        className={cn(
                          'tabular rounded px-1.5 py-0.5 text-[11px] font-semibold',
                          row.score >= 85 ? 'bg-pine-50 text-pine-700' : row.score >= 65 ? 'bg-amber-50 text-amber-700' : 'bg-brick-50 text-brick-700',
                        )}
                      >
                        {row.score}
                      </span>
                    </div>
                  </Td>
                  <Td align="right">
                    <span className="tabular inline-flex items-center gap-1 text-[12px] text-ink-700">
                      {row.avgRating > 0 ? row.avgRating.toFixed(1) : '—'}
                      <Star className="h-3 w-3 text-ink-300" aria-hidden />
                    </span>
                  </Td>
                  <Td align="right">
                    {row.openReviews > 0 ? (
                      <Badge tone={row.openReviews > 2 ? 'danger' : 'warning'}>{row.openReviews} open</Badge>
                    ) : (
                      <span className="text-[11px] text-ink-400">clear</span>
                    )}
                  </Td>
                  <Td align="right">
                    <span className="tabular text-[12px] text-ink-800">{formatCompact(row.calls)}</span>
                  </Td>
                  <Td>{row.spark.length > 1 && <Sparkline values={row.spark} width={64} height={18} />}</Td>
                  <Td>
                    <span className="text-[11px] text-ink-400">{formatRelative(row.location.last_synced_at)}</span>
                  </Td>
                  <Td>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(row.location);
                      }}
                      className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-800"
                      aria-label={`Edit ${row.location.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}

        {rows.length > PAGE_SIZE && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />
        )}
      </Card>

      <Drawer
        open={Boolean(drawerRow)}
        onClose={() => setDrawerId(null)}
        title={drawerRow?.location.name ?? ''}
        description={`${drawerRow?.location.city ?? ''} · ${drawerRow?.location.store_code ?? 'no store code'}`}
        footer={
          drawerRow && (
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openEdit(drawerRow.location)}
                icon={<Pencil className="h-3.5 w-3.5" />}
              >
                Edit outlet
              </Button>
              {canDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-brick-700 hover:bg-brick-50"
                  onClick={() => setConfirmDelete(drawerRow.location)}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Delete
                </Button>
              )}
            </div>
          )
        }
      >
        {drawerRow && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-lg border border-ink-200 p-3">
              <ScoreRing score={drawerRow.score} size={56} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink-900">
                  Audit score {drawerRow.score}/100
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">
                  {drawerRow.topFix ? `Biggest gap: ${drawerRow.topFix.title.toLowerCase()}` : 'No outstanding issues.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-ink-200 bg-ink-200">
              {[
                { label: 'Calls 30d', value: formatCompact(drawerRow.calls) },
                { label: 'Directions', value: formatCompact(drawerRow.directions) },
                { label: 'Rating', value: drawerRow.avgRating > 0 ? drawerRow.avgRating.toFixed(1) : '—' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white px-3 py-2">
                  <p className="label-caps">{stat.label}</p>
                  <p className="tabular mt-0.5 text-[15px] font-semibold text-ink-950">{stat.value}</p>
                </div>
              ))}
            </div>

            <section>
              <h3 className="mb-2 text-[12px] font-semibold text-ink-950">Findings</h3>
              {drawerRow.findings.length === 0 ? (
                <p className="rounded-lg bg-pine-50 px-3 py-2 text-[12px] text-pine-700">This profile passes all 13 checks.</p>
              ) : (
                <ul className="space-y-1.5">
                  {drawerRow.findings.map((finding) => (
                    <li key={finding.rule_key} className="rounded-lg border border-ink-200 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge tone={finding.severity === 'critical' ? 'danger' : finding.severity === 'warning' ? 'warning' : 'neutral'}>
                          −{finding.points_lost}
                        </Badge>
                        <p className="text-[12px] font-medium text-ink-900">{finding.title}</p>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{finding.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-[12px] font-semibold text-ink-950">Profile details</h3>
              <dl className="space-y-1.5 text-[12px]">
                {[
                  ['Address', [drawerRow.location.address_line1, drawerRow.location.city, drawerRow.location.state, drawerRow.location.postal_code].filter(Boolean).join(', ') || '—'],
                  ['Phone', drawerRow.location.phone ?? '—'],
                  ['Website', drawerRow.location.website ?? '—'],
                  ['Category', drawerRow.location.primary_category ?? '—'],
                  ['Hours', hoursSummary(drawerRow.location.hours)],
                  ['Photos', `${drawerRow.location.photo_count} · last added ${formatRelative(drawerRow.location.last_photo_at)}`],
                  ['Last synced', formatDate(drawerRow.location.last_synced_at)],
                  ['Reviews', `${drawerRow.totalReviews} total · ${drawerRow.openReviews} open`],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-3">
                    <dt className="w-[86px] shrink-0 text-ink-400">{label}</dt>
                    <dd className="min-w-0 flex-1 text-ink-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {drawerRow.location.website && (
              <a
                href={drawerRow.location.website}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-pine-700 hover:underline"
              >
                Open website <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </Drawer>

      <div className="mt-4">
        <DuplicatePanel />
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      {formModal}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return;
          try {
            await deleteLocation(confirmDelete.id);
            push({ tone: 'success', title: 'Outlet deleted' });
            setConfirmDelete(null);
            setDrawerId(null);
          } catch (error) {
            push({ tone: 'error', title: 'Could not delete', description: error instanceof Error ? error.message : 'Try again.' });
          }
        }}
        title={`Delete ${confirmDelete?.name ?? 'outlet'}?`}
        description="The outlet and its reviews are removed. Google Business Profile itself is not touched."
        confirmLabel="Delete outlet"
      />
    </AppShell>
  );
}

export default function LocationsPage() {
  return (
    <PageGuard>
      <LocationsInner />
    </PageGuard>
  );
}
