'use client';

import * as React from 'react';
import { Check, CornerDownRight, MessageSquareText, Sparkles, Star, Wand2 } from 'lucide-react';
import { AppShell, PageGuard } from '@/components/shell/AppShell';
import { Badge, Button, Card, EmptyState, Select, Skeleton, Tabs, Textarea } from '@/components/ui/primitives';
import { Modal, useToast } from '@/components/ui/overlay';
import { useStore } from '@/lib/data/store';
import { generateDraft } from '@/lib/data/ai';
import { isReplySafe } from '@/lib/domain/reviews';
import { can } from '@/lib/domain/permissions';
import { formatRelative } from '@/lib/domain/format';
import { cn } from '@/lib/utils';
import type { Review } from '@/lib/domain/types';

type StatusTab = 'open' | 'replied' | 'ignored' | 'all';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn('h-3 w-3', index < rating ? 'fill-amber-600 text-amber-600' : 'text-ink-200')}
          aria-hidden
        />
      ))}
    </span>
  );
}

function ReviewsInner() {
  const { data, org, role, replyReview, setReviewStatus } = useStore();
  const { push } = useToast();
  const [tab, setTab] = React.useState<StatusTab>('open');
  const [ratingFilter, setRatingFilter] = React.useState('all');
  const [locationFilter, setLocationFilter] = React.useState('all');
  const [active, setActive] = React.useState<Review | null>(null);
  const [draft, setDraft] = React.useState('');
  const [drafting, setDrafting] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [draftNote, setDraftNote] = React.useState<string | null>(null);

  const canReply = can(role, 'review:reply');

  const counts = React.useMemo(
    () => ({
      open: data.reviews.filter((r) => r.status === 'new' || r.status === 'drafted' || r.status === 'escalated').length,
      replied: data.reviews.filter((r) => r.status === 'replied').length,
      ignored: data.reviews.filter((r) => r.status === 'ignored').length,
      all: data.reviews.length,
    }),
    [data.reviews],
  );

  const filtered = React.useMemo(() => {
    return data.reviews
      .filter((review) => {
        if (tab === 'open') return review.status === 'new' || review.status === 'drafted' || review.status === 'escalated';
        if (tab === 'replied') return review.status === 'replied';
        if (tab === 'ignored') return review.status === 'ignored';
        return true;
      })
      .filter((review) => {
        if (ratingFilter === 'negative') return review.rating <= 2;
        if (ratingFilter === 'neutral') return review.rating === 3;
        if (ratingFilter === 'positive') return review.rating >= 4;
        return true;
      })
      .filter((review) => locationFilter === 'all' || review.location_id === locationFilter)
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'replied' ? 1 : -1;
        if (a.rating !== b.rating) return a.rating - b.rating;
        return b.published_at.localeCompare(a.published_at);
      });
  }, [data.reviews, tab, ratingFilter, locationFilter]);

  const openReview = (review: Review) => {
    setActive(review);
    setDraft(review.reply_text ?? review.draft_text ?? '');
    setDraftNote(null);
  };

  const draftReplyFor = async (review: Review) => {
    setDrafting(true);
    setDraftNote(null);
    try {
      const result = await generateDraft({
        authorName: review.author_name,
        rating: review.rating,
        comment: review.comment,
        locationName: review.location_name ?? 'the outlet',
        brandName: org?.name ?? 'our team',
      });
      setDraft(result.text);
      setDraftNote(result.degraded ?? 'Draft generated from the review text — read it before sending.');
    } catch (error) {
      push({ tone: 'error', title: 'Could not draft a reply', description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setDrafting(false);
    }
  };

  const send = async () => {
    if (!active) return;
    const safety = isReplySafe(draft);
    if (!safety.ok) {
      setDraftNote(safety.problems[0]);
      return;
    }
    setSending(true);
    try {
      await replyReview(active.id, draft.trim(), draftNote?.includes('template') ? 'rule' : 'human');
      push({ tone: 'success', title: 'Reply posted', description: `Your reply to ${active.author_name} is live on the profile.` });
      setActive(null);
    } catch (error) {
      push({ tone: 'error', title: 'Could not post the reply', description: error instanceof Error ? error.message : 'Try again.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell
      title="Reviews"
      subtitle={`${counts.open} open · ${counts.replied} replied across ${data.locations.length} outlets`}
    >
      <Card>
        <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
          <Tabs
            value={tab}
            onChange={(value) => setTab(value)}
            tabs={[
              { value: 'open', label: 'Open', count: counts.open },
              { value: 'replied', label: 'Replied', count: counts.replied },
              { value: 'ignored', label: 'Ignored', count: counts.ignored },
              { value: 'all', label: 'All', count: counts.all },
            ]}
            className="flex-1 border-b-0"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-y border-ink-200 px-3 py-2">
          <Select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} aria-label="Filter by rating" className="w-auto">
            <option value="all">All ratings</option>
            <option value="negative">1–2 stars</option>
            <option value="neutral">3 stars</option>
            <option value="positive">4–5 stars</option>
          </Select>
          <Select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} aria-label="Filter by outlet" className="w-auto max-w-[220px]">
            <option value="all">All outlets</option>
            {data.locations.map((location) => (
              <option key={location.id} value={location.id}>{location.name}</option>
            ))}
          </Select>
          <span className="ml-auto text-[11px] text-ink-400">{filtered.length} review{filtered.length === 1 ? '' : 's'}</span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquareText className="h-4.5 w-4.5" />}
            title={tab === 'open' ? 'Nothing waiting on you' : 'No reviews here'}
            description={
              tab === 'open'
                ? 'Every review has a reply or has been closed out. New reviews appear here within a minute of being published.'
                : 'Change the filters to see reviews in another state.'
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {filtered.map((review) => (
              <li key={review.id} className="px-4 py-3 transition-colors hover:bg-ink-50/50">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars rating={review.rating} />
                      <span className="text-[13px] font-medium text-ink-900">{review.author_name}</span>
                      <span className="text-[11px] text-ink-400">· {review.location_name}</span>
                      <span className="text-[11px] text-ink-400">· {formatRelative(review.published_at)}</span>
                      {review.sentiment === 'negative' && <Badge tone="danger">negative</Badge>}
                      {review.status === 'replied' && <Badge tone="positive">replied</Badge>}
                      {review.status === 'ignored' && <Badge tone="neutral">ignored</Badge>}
                    </div>
                    <p className="mt-1.5 max-w-[70ch] text-[13px] leading-relaxed text-ink-700">{review.comment ?? 'No comment left.'}</p>
                    {review.reply_text && (
                      <div className="mt-2 flex gap-2 rounded-lg bg-ink-50 px-3 py-2">
                        <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                        <div>
                          <p className="text-[12px] leading-relaxed text-ink-700">{review.reply_text}</p>
                          <p className="mt-1 text-[10px] text-ink-400">
                            Replied {formatRelative(review.replied_at)}
                            {review.draft_source ? ` · draft source: ${review.draft_source}` : ''}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {review.status !== 'replied' && canReply && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => openReview(review)} icon={<Wand2 className="h-3.5 w-3.5" />}>
                          Reply
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await setReviewStatus(review.id, 'ignored');
                            push({ tone: 'info', title: 'Review archived' });
                          }}
                        >
                          Ignore
                        </Button>
                      </>
                    )}
                    {review.status === 'replied' && (
                      <Button size="sm" variant="ghost" onClick={() => openReview(review)}>
                        View
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active ? `Reply to ${active.author_name}` : 'Reply'}
        description={active ? `${active.location_name} · ${active.rating}★ · ${formatRelative(active.published_at)}` : undefined}
        width="lg"
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => active && draftReplyFor(active)} loading={drafting} icon={<Sparkles className="h-3.5 w-3.5" />}>
              Draft with AI
            </Button>
            <Button size="sm" variant="primary" onClick={send} loading={sending} disabled={!canReply} icon={<Check className="h-3.5 w-3.5" />}>
              {active?.status === 'replied' ? 'Update reply' : 'Post reply'}
            </Button>
          </>
        }
      >
        {active && (
          <div className="space-y-3">
            <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3">
              <div className="flex items-center gap-2">
                <Stars rating={active.rating} />
                <span className="text-[12px] font-medium text-ink-900">{active.author_name}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-700">{active.comment ?? 'No comment left.'}</p>
            </div>

            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={6}
              placeholder="Write a reply that names the issue, says what you did about it, and invites them back."
              aria-label="Reply text"
            />
            <div className="flex items-center justify-between text-[11px] text-ink-400">
              <span>{draft.length} / 1200 characters</span>
              <span>Publicly visible on Google</span>
            </div>

            {draftNote && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-700">{draftNote}</p>
            )}
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

export default function ReviewsPage() {
  return (
    <PageGuard>
      <ReviewsInner />
    </PageGuard>
  );
}
