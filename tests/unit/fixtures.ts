import type { Location } from '@/lib/domain/types';

export function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: 'loc-1',
    org_id: 'org-1',
    name: 'Indiranagar',
    store_code: 'BLR-01',
    gbp_account_id: 'acc-1',
    gbp_location_id: 'gbp-1',
    address_line1: '12, 100 Feet Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    postal_code: '560038',
    country: 'IN',
    phone: '9876543210',
    website: 'https://example.com',
    primary_category: 'Coffee shop',
    additional_categories: ['Cafe'],
    description:
      'A neighbourhood coffee roastery on 100 Feet Road serving single-origin espresso, filter coffee and fresh bakes through the day, with seating for twenty.',
    hours: {
      mon: { open: '08:00', close: '22:00' },
      tue: { open: '08:00', close: '22:00' },
      wed: { open: '08:00', close: '22:00' },
      thu: { open: '08:00', close: '22:00' },
      fri: { open: '08:00', close: '22:00' },
      sat: { open: '09:00', close: '23:00' },
      sun: { open: '09:00', close: '21:00' },
    },
    attributes: { wheelchair_accessible: true, outdoor_seating: true },
    status: 'active',
    photo_count: 24,
    last_photo_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
    audit_score: 96,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export const NOW = new Date('2026-11-02T10:00:00.000Z');
