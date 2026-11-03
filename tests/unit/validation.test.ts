import { describe, expect, it } from 'vitest';
import { bulkEditSchema, firstError, inviteSchema, locationSchema, replySchema, settingsSchema } from '@/lib/domain/validation';

describe('locationSchema', () => {
  it('accepts a well formed outlet', () => {
    const result = locationSchema.safeParse({
      name: 'Indiranagar',
      city: 'Bengaluru',
      postal_code: '560038',
      phone: '9876543210',
      website: 'https://bluetokai.com',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty strings for optional fields', () => {
    const result = locationSchema.safeParse({ name: 'Bandra', city: '', postal_code: '', phone: '' });
    expect(result.success).toBe(true);
  });

  it('rejects a bad PIN code with a helpful message', () => {
    const result = locationSchema.safeParse({ name: 'Bandra', postal_code: '0123' });
    expect(result.success).toBe(false);
    if (!result.success) expect(firstError(result.error)).toContain('6 digits');
  });

  it('rejects a phone number that is not a valid Indian mobile', () => {
    expect(locationSchema.safeParse({ name: 'X', phone: '12345' }).success).toBe(false);
    expect(locationSchema.safeParse({ name: 'X', phone: '+91 98765 43210' }).success).toBe(true);
  });

  it('rejects a bare domain without a scheme', () => {
    const result = locationSchema.safeParse({ name: 'X', website: 'bluetokai.com' });
    expect(result.success).toBe(false);
  });

  it('requires a name', () => {
    expect(locationSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
});

describe('bulkEditSchema', () => {
  const id = '11111111-1111-1111-1111-111111111111';

  it('requires at least one outlet', () => {
    const result = bulkEditSchema.safeParse({ kind: 'sync', locationIds: [] });
    expect(result.success).toBe(false);
  });

  it('requires hours when the kind is hours', () => {
    const result = bulkEditSchema.safeParse({ kind: 'hours', locationIds: [id], hours: {} });
    expect(result.success).toBe(false);
  });

  it('rejects closing time before opening time', () => {
    const result = bulkEditSchema.safeParse({
      kind: 'hours',
      locationIds: [id],
      hours: { mon: { open: '22:00', close: '09:00' } },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain('Closing time');
  });

  it('accepts a valid hours payload', () => {
    const result = bulkEditSchema.safeParse({
      kind: 'hours',
      locationIds: [id],
      hours: { mon: { open: '09:00', close: '21:00' }, sun: null },
    });
    expect(result.success).toBe(true);
  });

  it('requires a description for the description kind', () => {
    expect(bulkEditSchema.safeParse({ kind: 'description', locationIds: [id] }).success).toBe(false);
    expect(bulkEditSchema.safeParse({ kind: 'description', locationIds: [id], description: 'Roastery and cafe.' }).success).toBe(true);
  });

  it('requires attributes for the attributes kind', () => {
    expect(bulkEditSchema.safeParse({ kind: 'attributes', locationIds: [id], attributes: {} }).success).toBe(false);
  });
});

describe('replySchema', () => {
  it('enforces a minimum and maximum length', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    expect(replySchema.safeParse({ reviewId: id, reply: 'Too short' }).success).toBe(false);
    expect(replySchema.safeParse({ reviewId: id, reply: 'x'.repeat(1300) }).success).toBe(false);
    expect(replySchema.safeParse({ reviewId: id, reply: 'Thanks for the detailed feedback, we are on it.' }).success).toBe(true);
  });
});

describe('inviteSchema and settingsSchema', () => {
  it('validates an invite', () => {
    expect(inviteSchema.safeParse({ email: 'ops@brand.com', role: 'admin' }).success).toBe(true);
    expect(inviteSchema.safeParse({ email: 'nope', role: 'admin' }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: 'ops@brand.com', role: 'owner' }).success).toBe(false);
  });

  it('validates brand settings', () => {
    expect(settingsSchema.safeParse({ name: 'Blue Tokai', brand_color: '#0E5B46', plan: 'growth' }).success).toBe(true);
    expect(settingsSchema.safeParse({ name: 'Blue Tokai', brand_color: 'green', plan: 'growth' }).success).toBe(false);
  });
});
