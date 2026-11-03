'use client';

import * as React from 'react';
import { CheckCircle2, Link2, Lock, RefreshCw, Save, TriangleAlert } from 'lucide-react';
import { AppShell, PageGuard } from '@/components/shell/AppShell';
import { Badge, Button, Card, CardHeader, Field, Input, Select } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/overlay';
import { supabaseReady, useStore } from '@/lib/data/store';
import { can } from '@/lib/domain/permissions';
import { firstError, settingsSchema } from '@/lib/domain/validation';
import { formatRelative } from '@/lib/domain/format';
import { cn } from '@/lib/utils';

function SettingsInner() {
  const { org, role, mode, data, updateOrg, syncNow, user } = useStore();
  const { push } = useToast();
  const [name, setName] = React.useState(org?.name ?? '');
  const [colour, setColour] = React.useState(org?.brand_color ?? '#0E5B46');
  const [plan, setPlan] = React.useState(org?.plan ?? 'growth');
  const [busy, setBusy] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (org) {
      setName(org.name);
      setColour(org.brand_color);
      setPlan(org.plan);
    }
  }, [org]);

  const canEdit = can(role, 'org:update');
  const connection = data.connection;

  const save = async () => {
    const parsed = settingsSchema.safeParse({ name, brand_color: colour, plan });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateOrg(parsed.data);
      push({ tone: 'success', title: 'Settings saved' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Settings" subtitle="Brand profile, connection and environment">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Brand profile" description="Shown on reports and used to sign review replies" />
            <div className="space-y-3 p-4">
              <Field label="Brand name" htmlFor="brand-name" error={error ?? undefined}>
                <Input id="brand-name" value={name} onChange={(event) => setName(event.target.value)} disabled={!canEdit} invalid={Boolean(error)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Brand colour" htmlFor="brand-colour" hint="Used for accents in exported reports.">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Pick brand colour"
                      value={colour}
                      onChange={(event) => setColour(event.target.value)}
                      disabled={!canEdit}
                      className="h-9 w-10 cursor-pointer rounded-lg border border-ink-200 bg-white p-1"
                    />
                    <Input id="brand-colour" value={colour} onChange={(event) => setColour(event.target.value)} disabled={!canEdit} className="font-mono" />
                  </div>
                </Field>
                <Field label="Plan" htmlFor="brand-plan" hint="Seats are enforced server-side by plan.">
                  <Select id="brand-plan" value={plan} onChange={(event) => setPlan(event.target.value as typeof plan)} disabled={!canEdit}>
                    <option value="trial">Trial</option>
                    <option value="growth">Growth</option>
                    <option value="scale">Scale</option>
                    <option value="enterprise">Enterprise</option>
                  </Select>
                </Field>
              </div>
              <div className="flex items-center justify-between border-t border-ink-100 pt-3">
                <p className="text-[11px] text-ink-400">Workspace slug: <span className="font-mono text-ink-600">{org?.slug}</span></p>
                <Button size="sm" variant="primary" onClick={save} loading={busy} disabled={!canEdit} icon={<Save className="h-3.5 w-3.5" />}>
                  Save changes
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Google Business Profile"
              description="The source of locations, reviews and performance data"
              action={
                <Badge tone={connection?.status === 'connected' ? 'positive' : 'warning'} dot>
                  {connection?.status ?? 'not connected'}
                </Badge>
              }
            />
            <div className="space-y-3 p-4">
              <dl className="space-y-1.5 text-[12px]">
                {[
                  ['Account', connection?.display_name ?? '—'],
                  ['Connected', formatRelative(connection?.connected_at ?? null)],
                  ['Last sync', formatRelative(connection?.last_synced_at ?? null)],
                  ['Locations synced', String(data.locations.filter((l) => l.last_synced_at).length)],
                ].map(([label, value]) => (
                  <div key={label} className="flex gap-3">
                    <dt className="w-[110px] shrink-0 text-ink-400">{label}</dt>
                    <dd className="text-ink-800">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={syncing}
                  onClick={async () => {
                    setSyncing(true);
                    try {
                      await syncNow();
                      push({ tone: 'success', title: 'Sync complete' });
                    } catch (err) {
                      push({ tone: 'error', title: 'Sync failed', description: err instanceof Error ? err.message : 'Try again.' });
                    } finally {
                      setSyncing(false);
                    }
                  }}
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                >
                  Sync now
                </Button>
                <Button size="sm" variant="primary" disabled={!canEdit || mode === 'demo'} icon={<Link2 className="h-3.5 w-3.5" />}>
                  {connection?.status === 'connected' ? 'Reconnect Google' : 'Connect Google'}
                </Button>
              </div>

              {mode === 'demo' && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This is the demo workspace, so the Google connection is simulated. With Supabase configured, “Connect Google”
                  starts the real OAuth flow against the Business Profile API through an Edge Function.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Environment" />
            <ul className="divide-y divide-ink-100 text-[12px]">
              {[
                ['Signed in as', user?.email ?? '—'],
                ['Your role', role ?? '—'],
                ['Data source', mode === 'demo' ? 'Demo workspace (local)' : 'Supabase (live)'],
                ['Supabase configured', supabaseReady ? 'yes' : 'no'],
                ['Outlets', String(data.locations.length)],
                ['Reviews loaded', String(data.reviews.length)],
              ].map(([label, value]) => (
                <li key={label} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-ink-400">{label}</span>
                  <span className={cn('font-medium text-ink-800', value === 'no' && 'text-amber-700')}>{value}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-pine-600" aria-hidden />
              <p className="text-[12px] font-semibold text-ink-950">Security model</p>
            </div>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-ink-500">
              <li className="flex gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-pine-600" />
                Row-level security on every table; membership is checked by a security-definer function.
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-pine-600" />
                Google OAuth tokens live in a table with no policies — only the service role can read them.
              </li>
              <li className="flex gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-pine-600" />
                The browser only ever holds the anon key; every write is authorised by the database, not the UI.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <PageGuard>
      <SettingsInner />
    </PageGuard>
  );
}
