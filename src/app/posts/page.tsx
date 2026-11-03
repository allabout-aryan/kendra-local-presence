'use client';

import * as React from 'react';
import { CalendarClock, CheckCircle2, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { AppShell, PageGuard } from '@/components/shell/AppShell';
import {
  Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Tabs, Textarea,
} from '@/components/ui/primitives';
import { ConfirmDialog, Modal, useToast } from '@/components/ui/overlay';
import { useStore } from '@/lib/data/store';
import { can } from '@/lib/domain/permissions';
import { formatRelative } from '@/lib/domain/format';
import { cn } from '@/lib/utils';
import type { Post } from '@/lib/domain/types';

const CTA_OPTIONS = [
  { value: 'none', label: 'No button' },
  { value: 'call', label: 'Call now' },
  { value: 'book', label: 'Book' },
  { value: 'order', label: 'Order online' },
  { value: 'shop', label: 'Shop' },
  { value: 'learn_more', label: 'Learn more' },
  { value: 'sign_up', label: 'Sign up' },
];

const STATUS_TONE: Record<Post['status'], 'neutral' | 'info' | 'positive' | 'danger'> = {
  draft: 'neutral',
  scheduled: 'info',
  published: 'positive',
  failed: 'danger',
};

function PostsInner() {
  const { data, role, savePost, publishPost, deletePost } = useStore();
  const { push } = useToast();
  const [tab, setTab] = React.useState<'all' | Post['status']>('all');
  const [editing, setEditing] = React.useState<Post | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [locationId, setLocationId] = React.useState('');
  const [body, setBody] = React.useState('');
  const [cta, setCta] = React.useState('none');
  const [ctaUrl, setCtaUrl] = React.useState('');
  const [scheduledFor, setScheduledFor] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<Post | null>(null);

  const canEdit = can(role, 'bulk:run');

  const counts = React.useMemo(
    () => ({
      all: data.posts.length,
      draft: data.posts.filter((post) => post.status === 'draft').length,
      scheduled: data.posts.filter((post) => post.status === 'scheduled').length,
      published: data.posts.filter((post) => post.status === 'published').length,
      failed: data.posts.filter((post) => post.status === 'failed').length,
    }),
    [data.posts],
  );

  const visible = data.posts
    .filter((post) => tab === 'all' || post.status === tab)
    .sort((a, b) => (b.scheduled_for ?? b.created_at).localeCompare(a.scheduled_for ?? a.created_at));

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setLocationId(data.locations[0]?.id ?? '');
    setBody('');
    setCta('none');
    setCtaUrl('');
    setScheduledFor('');
    setError(null);
  };

  const openEdit = (post: Post) => {
    setEditing(post);
    setCreating(false);
    setLocationId(post.location_id);
    setBody(post.body);
    setCta(post.cta_type ?? 'none');
    setCtaUrl(post.cta_url ?? '');
    setScheduledFor(post.scheduled_for ? post.scheduled_for.slice(0, 16) : '');
    setError(null);
  };

  const submit = async () => {
    if (body.trim().length < 10) {
      setError('A post needs at least 10 characters.');
      return;
    }
    if (cta !== 'none' && ctaUrl && !/^https?:\/\//.test(ctaUrl)) {
      setError('The link must start with http:// or https://');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await savePost(
        {
          location_id: locationId,
          body: body.trim(),
          cta_type: cta,
          cta_url: ctaUrl || undefined,
          scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        },
        editing?.id,
      );
      push({ tone: 'success', title: editing ? 'Post updated' : scheduledFor ? 'Post scheduled' : 'Draft saved' });
      setCreating(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the post');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Posts"
      subtitle="What goes out on your Google profiles, and when"
      actions={
        canEdit ? (
          <Button size="sm" variant="primary" onClick={openCreate} icon={<Plus className="h-3.5 w-3.5" />}>
            New post
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <div className="px-3 pt-2">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'scheduled', label: 'Scheduled', count: counts.scheduled },
                { value: 'draft', label: 'Drafts', count: counts.draft },
                { value: 'published', label: 'Published', count: counts.published },
                { value: 'failed', label: 'Failed', count: counts.failed },
              ]}
              className="border-b-0"
            />
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-4.5 w-4.5" />}
              title="Nothing here yet"
              description="Google posts keep a profile active between reviews. Write one, schedule it across a few outlets, and it shows up in local results."
              action={canEdit ? <Button variant="primary" onClick={openCreate}>Write the first post</Button> : undefined}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {visible.map((post) => (
                <li key={post.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[post.status]}>{post.status}</Badge>
                        <span className="text-[11px] text-ink-400">{post.location_name}</span>
                        <span className="text-[11px] text-ink-400">
                          {post.status === 'published'
                            ? `published ${formatRelative(post.published_at)}`
                            : post.scheduled_for
                              ? `due ${formatRelative(post.scheduled_for)}`
                              : `draft · ${formatRelative(post.created_at)}`}
                        </span>
                      </div>
                      <p className="mt-1.5 max-w-[70ch] whitespace-pre-line text-[13px] leading-relaxed text-ink-800">{post.body}</p>
                      {post.cta_type && post.cta_type !== 'none' && (
                        <p className="mt-1 text-[11px] text-ink-400">
                          Button: {CTA_OPTIONS.find((option) => option.value === post.cta_type)?.label}
                          {post.cta_url ? ` · ${post.cta_url}` : ''}
                        </p>
                      )}
                      {post.error && <p className="mt-1 text-[11px] text-brick-700">{post.error}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex shrink-0 items-center gap-1">
                        {post.status !== 'published' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<Send className="h-3.5 w-3.5" />}
                            onClick={async () => {
                              try {
                                await publishPost(post.id);
                                push({ tone: 'success', title: 'Post published', description: `Live on ${post.location_name}.` });
                              } catch (err) {
                                push({ tone: 'error', title: 'Publish failed', description: err instanceof Error ? err.message : 'Try again.' });
                              }
                            }}
                          >
                            Publish
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEdit(post)} icon={<Pencil className="h-3.5 w-3.5" />}>
                          <span className="sr-only">Edit post</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-brick-700 hover:bg-brick-50"
                          onClick={() => setRemoving(post)}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                          <span className="sr-only">Delete post</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <p className="label-caps">Publishing queue</p>
            <div className="mt-2 space-y-2">
              {[
                { label: 'Scheduled', value: counts.scheduled, tone: 'text-sky-600' },
                { label: 'Drafts', value: counts.draft, tone: 'text-ink-700' },
                { label: 'Published', value: counts.published, tone: 'text-pine-700' },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between">
                  <span className="text-[12px] text-ink-500">{row.label}</span>
                  <span className={cn('tabular text-[15px] font-semibold', row.tone)}>{row.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-pine-600" aria-hidden />
              <p className="text-[12px] font-semibold text-ink-950">Why this matters</p>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">
              Profiles that post regularly surface more often in the local pack. Scheduled posts are picked up by the
              sync worker and pushed to Google; the per-post status records what happened.
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={creating || Boolean(editing)}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? 'Edit post' : 'New Google post'}
        description="Up to 1,500 characters. Add a button to give people something to do next."
        width="lg"
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" loading={busy} onClick={submit}>
              {scheduledFor ? 'Schedule post' : 'Save draft'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Outlet" required>
            <Select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
              {data.locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name} · {location.city}</option>
              ))}
            </Select>
          </Field>

          <Field label="Post body" required hint={`${body.length}/1500 characters`} error={error ?? undefined}>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder="New season, new beans: the Ratnagiri washed lot is on the bar from Friday." />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Button">
              <Select value={cta} onChange={(event) => setCta(event.target.value)}>
                {CTA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Button link" hint="Required if you add a button.">
              <Input value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} placeholder="https://bluetokai.com/lots" />
            </Field>
          </div>

          <Field label="Schedule for" hint="Leave empty to keep it as a draft.">
            <Input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await deletePost(removing.id);
            push({ tone: 'success', title: 'Post deleted' });
            setRemoving(null);
          } catch (err) {
            push({ tone: 'error', title: 'Could not delete', description: err instanceof Error ? err.message : 'Try again.' });
          }
        }}
        title="Delete this post?"
        description="If it has already published on Google, it stays there until it expires."
        confirmLabel="Delete post"
      />
    </AppShell>
  );
}

export default function PostsPage() {
  return (
    <PageGuard>
      <PostsInner />
    </PageGuard>
  );
}
