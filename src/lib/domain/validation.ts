import { z } from 'zod';
import { WEEKDAYS } from './hours';

const timeString = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Use 24-hour HH:MM');

export const businessHoursSchema = z.record(
  z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
  z.union([z.null(), z.object({ open: timeString, close: timeString })]).optional(),
);

export const orgCreateSchema = z.object({
  name: z.string().trim().min(2, 'Brand name needs at least 2 characters').max(120),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{1,60}$/, 'Lowercase letters, numbers and hyphens only')
    .optional()
    .or(z.literal('')),
});

export const locationSchema = z.object({
  name: z.string().trim().min(1, 'Outlet name is required').max(120),
  store_code: z.string().trim().max(40).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  state: z.string().trim().max(80).optional().or(z.literal('')),
  postal_code: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Indian PIN codes are 6 digits')
    .optional()
    .or(z.literal('')),
  address_line1: z.string().trim().max(200).optional().or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9](?:[\s-]?\d){9}$/, 'Enter a 10-digit Indian mobile number')
    .optional()
    .or(z.literal('')),
  website: z.string().trim().url('Enter a full URL, including https://').optional().or(z.literal('')),
  primary_category: z.string().trim().max(80).optional().or(z.literal('')),
  description: z.string().trim().max(750).optional().or(z.literal('')),
  status: z.enum(['active', 'paused', 'pending_sync', 'disconnected']).default('active'),
  hours: businessHoursSchema.optional(),
});

export type LocationInput = z.infer<typeof locationSchema>;

export const bulkEditSchema = z
  .object({
    kind: z.enum(['hours', 'attributes', 'description', 'photos', 'posts', 'sync']),
    locationIds: z.array(z.string().uuid()).min(1, 'Select at least one outlet'),
    hours: businessHoursSchema.optional(),
    description: z.string().trim().max(750).optional(),
    attributes: z.record(z.union([z.boolean(), z.string()])).optional(),
    keepClosedDays: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'hours') {
      const filled = WEEKDAYS.filter((day) => value.hours?.[day]);
      if (filled.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hours'], message: 'Set at least one day of hours' });
      }
      for (const day of WEEKDAYS) {
        const slot = value.hours?.[day];
        if (slot && slot.open >= slot.close) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hours', day], message: 'Closing time must be after opening time' });
        }
      }
    }
    if (value.kind === 'description' && !value.description) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['description'], message: 'Description cannot be empty' });
    }
    if (value.kind === 'attributes' && (!value.attributes || Object.keys(value.attributes).length === 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['attributes'], message: 'Pick at least one attribute' });
    }
  });

export type BulkEditInput = z.infer<typeof bulkEditSchema>;

export const replySchema = z.object({
  reviewId: z.string().uuid(),
  reply: z
    .string()
    .trim()
    .min(20, 'A useful reply is at least 20 characters')
    .max(1200, 'Keep replies under 1,200 characters'),
});

export const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  role: z.enum(['admin', 'member', 'viewer']),
});

export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  brand_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Pick a hex colour'),
  plan: z.enum(['trial', 'growth', 'scale', 'enterprise']),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Something needs fixing';
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
