import { describe, expect, it } from 'vitest';
import { can, roleDescription, roleLabel } from '@/lib/domain/permissions';

describe('can', () => {
  it('denies everything when there is no membership', () => {
    expect(can(null, 'location:update')).toBe(false);
    expect(can(undefined, 'report:export')).toBe(false);
  });

  it('lets viewers read and export but never write', () => {
    expect(can('viewer', 'report:export')).toBe(true);
    expect(can('viewer', 'location:update')).toBe(false);
    expect(can('viewer', 'review:reply')).toBe(false);
  });

  it('lets members run the day to day but not delete outlets', () => {
    expect(can('member', 'location:create')).toBe(true);
    expect(can('member', 'bulk:run')).toBe(true);
    expect(can('member', 'location:delete')).toBe(false);
    expect(can('member', 'team:manage')).toBe(false);
  });

  it('reserves destructive and administrative actions for owner and admin', () => {
    for (const role of ['owner', 'admin'] as const) {
      expect(can(role, 'location:delete')).toBe(true);
      expect(can(role, 'team:manage')).toBe(true);
      expect(can(role, 'connection:manage')).toBe(true);
    }
  });
});

describe('labels', () => {
  it('has a human label and description for every role', () => {
    for (const role of ['owner', 'admin', 'member', 'viewer'] as const) {
      expect(roleLabel(role).length).toBeGreaterThan(2);
      expect(roleDescription(role).length).toBeGreaterThan(10);
    }
  });
});
