import type { MemberRole } from './types';

export type Action =
  | 'location:create'
  | 'location:update'
  | 'location:delete'
  | 'review:draft'
  | 'review:reply'
  | 'bulk:run'
  | 'report:export'
  | 'team:manage'
  | 'org:update'
  | 'connection:manage';

const MATRIX: Record<Action, MemberRole[]> = {
  'location:create': ['owner', 'admin', 'member'],
  'location:update': ['owner', 'admin', 'member'],
  'location:delete': ['owner', 'admin'],
  'review:draft': ['owner', 'admin', 'member'],
  'review:reply': ['owner', 'admin', 'member'],
  'bulk:run': ['owner', 'admin', 'member'],
  'report:export': ['owner', 'admin', 'member', 'viewer'],
  'team:manage': ['owner', 'admin'],
  'org:update': ['owner', 'admin'],
  'connection:manage': ['owner', 'admin'],
};

export function can(role: MemberRole | null | undefined, action: Action): boolean {
  if (!role) return false;
  return MATRIX[action].includes(role);
}

export function roleLabel(role: MemberRole): string {
  return { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' }[role];
}

export function roleDescription(role: MemberRole): string {
  return {
    owner: 'Full control, including billing and removing admins.',
    admin: 'Manage outlets, connections and the team.',
    member: 'Edit outlets, reply to reviews, run bulk edits.',
    viewer: 'Read-only access to dashboards and reports.',
  }[role];
}
