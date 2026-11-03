'use client';

import * as React from 'react';
import { Mail, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { AppShell, PageGuard } from '@/components/shell/AppShell';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select } from '@/components/ui/primitives';
import { ConfirmDialog, Modal, useToast } from '@/components/ui/overlay';
import { useStore } from '@/lib/data/store';
import { can, roleDescription, roleLabel } from '@/lib/domain/permissions';
import { firstError, inviteSchema } from '@/lib/domain/validation';
import { formatDate } from '@/lib/domain/format';
import type { MemberRole } from '@/lib/domain/types';

function TeamInner() {
  const { data, org, role, inviteMember, removeMember, user } = useStore();
  const { push } = useToast();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [inviteRole, setInviteRole] = React.useState<MemberRole>('member');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const canManage = can(role, 'team:manage');
  const seatsUsed = data.members.length;

  const submitInvite = async () => {
    const parsed = inviteSchema.safeParse({ email, role: inviteRole === 'owner' ? 'admin' : inviteRole });
    if (!parsed.success) {
      setError(firstError(parsed.error));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await inviteMember(parsed.data.email, parsed.data.role as MemberRole);
      push({ tone: 'success', title: 'Member added', description: `${parsed.data.email} can now access ${org?.name}.` });
      setInviteOpen(false);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that person');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Team"
      subtitle={`${seatsUsed} of ${org?.seat_limit ?? 0} seats used`}
      actions={
        canManage ? (
          <Button size="sm" variant="primary" onClick={() => { setInviteOpen(true); setError(null); }} icon={<UserPlus className="h-3.5 w-3.5" />}>
            Add member
          </Button>
        ) : undefined
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader title="Members" description="Roles decide what each person can change" />
          {data.members.length === 0 ? (
            <EmptyState icon={<Users className="h-4.5 w-4.5" />} title="No members yet" description="Add your first teammate to share the workload." />
          ) : (
            <ul className="divide-y divide-ink-100">
              {data.members.map((member) => (
                <li key={member.user_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={member.profile?.full_name ?? member.profile?.email ?? 'Member'} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
                      {member.profile?.full_name ?? 'Unnamed member'}
                      {member.user_id === user?.id && <Badge tone="info">you</Badge>}
                    </p>
                    <p className="truncate text-[11px] text-ink-400">{member.profile?.email ?? '—'}</p>
                  </div>
                  <div className="text-right">
                    <Badge tone={member.role === 'owner' ? 'accent' : member.role === 'viewer' ? 'neutral' : 'positive'}>
                      {roleLabel(member.role)}
                    </Badge>
                    <p className="mt-0.5 text-[10px] text-ink-400">joined {formatDate(member.created_at)}</p>
                  </div>
                  {canManage && member.role !== 'owner' && (
                    <Button size="sm" variant="ghost" className="text-brick-700 hover:bg-brick-50" onClick={() => setRemoving(member.user_id)}>
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Roles" description="What each role can do" />
            <ul className="space-y-2.5 p-3.5">
              {(['owner', 'admin', 'member', 'viewer'] as MemberRole[]).map((item) => (
                <li key={item}>
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-ink-900">
                    <ShieldCheck className="h-3.5 w-3.5 text-ink-400" aria-hidden />
                    {roleLabel(item)}
                  </p>
                  <p className="mt-0.5 pl-5 text-[11px] leading-relaxed text-ink-500">{roleDescription(item)}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-3.5">
            <p className="label-caps">Seats</p>
            <p className="tabular mt-1 text-[22px] font-semibold text-ink-950">
              {seatsUsed}<span className="text-[13px] font-normal text-ink-400"> / {org?.seat_limit ?? 0}</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
              Seats are enforced in the database — adding a member beyond the limit fails with a clear error rather than silently succeeding.
            </p>
          </Card>
        </div>
      </div>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Add a team member"
        description="They must already have a Kendra account with this email address."
        width="sm"
        footer={
          <>
            <Button size="sm" variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button size="sm" variant="primary" loading={busy} onClick={submitInvite}>Add member</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Email address" required error={error ?? undefined} htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@brand.com"
              invalid={Boolean(error)}
              autoFocus
            />
          </Field>
          <Field label="Role" htmlFor="invite-role" hint={roleDescription(inviteRole)}>
            <Select id="invite-role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as MemberRole)}>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </Select>
          </Field>
          <p className="flex items-start gap-2 rounded-lg bg-ink-50 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Kendra does not send the invitation email itself — share the workspace link with them once added.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await removeMember(removing);
            push({ tone: 'success', title: 'Member removed' });
            setRemoving(null);
          } catch (err) {
            push({ tone: 'error', title: 'Could not remove', description: err instanceof Error ? err.message : 'Try again.' });
          }
        }}
        title="Remove this member?"
        description="They lose access immediately. Their past activity stays in the audit trail."
        confirmLabel="Remove member"
      />
    </AppShell>
  );
}

export default function TeamPage() {
  return (
    <PageGuard>
      <TeamInner />
    </PageGuard>
  );
}
