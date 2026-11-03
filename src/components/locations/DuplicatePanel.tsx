'use client';

import * as React from 'react';
import { ArrowRight, Copy, GitMerge } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState } from '@/components/ui/primitives';
import { ConfirmDialog, useToast } from '@/components/ui/overlay';
import { findDuplicateGroups, planMerge, type DuplicateGroup } from '@/lib/domain/duplicates';
import { useStore } from '@/lib/data/store';
import { can } from '@/lib/domain/permissions';

export function DuplicatePanel() {
  const { data, role, mergeOutlets } = useStore();
  const { push } = useToast();
  const [target, setTarget] = React.useState<DuplicateGroup | null>(null);
  const [busy, setBusy] = React.useState(false);

  const groups = React.useMemo(() => findDuplicateGroups(data.locations), [data.locations]);
  const canMerge = can(role, 'location:delete');

  const counts = React.useMemo(
    () => ({
      reviews: Object.fromEntries(
        data.locations.map((location) => [
          location.id,
          data.reviews.filter((review) => review.location_id === location.id).length,
        ]),
      ),
      metrics: Object.fromEntries(
        data.locations.map((location) => [
          location.id,
          data.metrics.filter((snapshot) => snapshot.location_id === location.id).length,
        ]),
      ),
      ranks: Object.fromEntries(
        data.locations.map((location) => [location.id, data.ranks.filter((rank) => rank.location_id === location.id).length]),
      ),
    }),
    [data.locations, data.reviews, data.metrics, data.ranks],
  );

  const plan = target ? planMerge(target, counts) : null;

  return (
    <Card>
      <CardHeader
        title="Duplicate listings"
        description="Two profiles for one store split ranking signals"
        action={<Badge tone={groups.length > 0 ? 'warning' : 'positive'}>{groups.length} group(s)</Badge>}
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={<Copy className="h-4.5 w-4.5" />}
          title="No duplicates found"
          description="Every outlet has a unique name within its city. New imports are checked for this automatically."
        />
      ) : (
        <ul className="divide-y divide-ink-100">
          {groups.map((group) => (
            <li key={group.key} className="px-4 py-3">
              <p className="text-[13px] font-medium text-ink-900">{group.label}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">{group.reason}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                {group.members.map((member) => (
                  <span
                    key={member.id}
                    className={
                      member.id === group.keeper.id
                        ? 'rounded border border-pine-100 bg-pine-50 px-1.5 py-0.5 text-pine-700'
                        : 'rounded border border-ink-200 bg-white px-1.5 py-0.5 text-ink-600'
                    }
                  >
                    {member.store_code ?? member.name} · {member.photo_count} photos
                    {member.id === group.keeper.id ? ' · keep' : ''}
                  </span>
                ))}
                <ArrowRight className="h-3 w-3 text-ink-300" aria-hidden />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canMerge}
                  onClick={() => setTarget(group)}
                  icon={<GitMerge className="h-3.5 w-3.5" />}
                >
                  Merge
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        loading={busy}
        onConfirm={async () => {
          if (!plan) return;
          setBusy(true);
          try {
            await mergeOutlets(plan.keeperId, plan.mergeIds);
            push({
              tone: 'success',
              title: 'Listings merged',
              description: `${plan.reviewsMoved} reviews moved onto the surviving outlet.`,
            });
            setTarget(null);
          } catch (error) {
            push({ tone: 'error', title: 'Merge failed', description: error instanceof Error ? error.message : 'Try again.' });
          } finally {
            setBusy(false);
          }
        }}
        title={`Merge into ${target?.keeper.name ?? ''}?`}
        description={
          plan
            ? `${plan.reviewsMoved} reviews and ${plan.metricsMoved} metric rows move across. ${plan.ranksDropped} rank snapshots for the duplicate are dropped, and the duplicate profile is removed here. Google itself is untouched.`
            : ''
        }
        confirmLabel="Merge listings"
      />
    </Card>
  );
}
