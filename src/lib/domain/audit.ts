import type { Location, Severity, Weekday } from './types';
import { missingDays, WEEKDAYS } from './hours';

export interface AuditInput {
  location: Pick<
    Location,
    | 'name' | 'primary_category' | 'additional_categories' | 'description' | 'hours'
    | 'phone' | 'website' | 'address_line1' | 'city' | 'postal_code'
    | 'photo_count' | 'last_photo_at' | 'store_code' | 'status'
  >;
  openNegativeReviews: number;
  avgRating: number;
  totalReviews: number;
  duplicateSuspects?: number;
  now?: Date;
}

export interface AuditFinding {
  rule_key: string;
  severity: Severity;
  title: string;
  detail: string;
  points_lost: number;
}

export interface AuditResult {
  score: number;
  band: 'healthy' | 'attention' | 'critical';
  findings: AuditFinding[];
  topFix: AuditFinding | null;
}

interface Rule {
  key: string;
  severity: Severity;
  points: number;
  title: string;
  evaluate: (input: AuditInput) => string | null;
}

const DAYS_FOR_PENALTY = 90;

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 86_400_000);
}

/**
 * The audit is deliberately rule-based, not model-based: a brand manager needs
 * to know exactly which field on which outlet costs them points, and needs the
 * same answer tomorrow. Each rule's weight is fixed and versioned here.
 */
export const AUDIT_RULES: Rule[] = [
  {
    key: 'missing_category',
    severity: 'critical',
    points: 15,
    title: 'No primary category',
    evaluate: ({ location }) => (location.primary_category ? null : 'Google cannot rank an outlet that has no primary category.'),
  },
  {
    key: 'missing_hours',
    severity: 'critical',
    points: 12,
    title: 'Opening hours incomplete',
    evaluate: ({ location }) => {
      const missing = missingDays(location.hours);
      if (missing.length === 0) return null;
      return `No hours set for ${missing.length} day(s): ${missing.map((d) => d.toUpperCase()).join(', ')}. Shoppers see "hours unknown".`;
    },
  },
  {
    key: 'missing_address',
    severity: 'critical',
    points: 10,
    title: 'Address incomplete',
    evaluate: ({ location }) => {
      const missing: string[] = [];
      if (!location.address_line1) missing.push('street');
      if (!location.city) missing.push('city');
      if (!location.postal_code) missing.push('PIN code');
      return missing.length ? `Missing ${missing.join(', ')} — this weakens map pin accuracy.` : null;
    },
  },
  {
    key: 'no_photos',
    severity: 'critical',
    points: 14,
    title: 'No photos on the profile',
    evaluate: ({ location }) => (location.photo_count === 0 ? 'Profiles with photos get materially more direction requests.' : null),
  },
  {
    key: 'stale_photos',
    severity: 'warning',
    points: 7,
    title: 'Photos are stale',
    evaluate: ({ location, now = new Date() }) => {
      if (location.photo_count === 0) return null;
      const age = daysSince(location.last_photo_at, now);
      if (age === null) return 'No photo upload date recorded.';
      return age > DAYS_FOR_PENALTY ? `Last photo added ${age} days ago (threshold ${DAYS_FOR_PENALTY}).` : null;
    },
  },
  {
    key: 'missing_description',
    severity: 'warning',
    points: 8,
    title: 'No business description',
    evaluate: ({ location }) => (!location.description ? 'Add a 250-character description with the category and locality.' : null),
  },
  {
    key: 'thin_description',
    severity: 'info',
    points: 3,
    title: 'Description is thin',
    evaluate: ({ location }) => {
      const length = location.description?.trim().length ?? 0;
      if (length === 0 || length >= 180) return null;
      return `Description is ${length} characters; aim for 250+.`;
    },
  },
  {
    key: 'missing_phone',
    severity: 'warning',
    points: 6,
    title: 'No phone number',
    evaluate: ({ location }) => (location.phone ? null : 'Calls are the highest-intent action on a local profile.'),
  },
  {
    key: 'missing_website',
    severity: 'info',
    points: 4,
    title: 'No website link',
    evaluate: ({ location }) => (location.website ? null : 'Without a link, high-intent traffic has nowhere to go.'),
  },
  {
    key: 'unanswered_negative',
    severity: 'critical',
    points: 12,
    title: 'Negative reviews unanswered',
    evaluate: ({ openNegativeReviews }) =>
      openNegativeReviews > 0
        ? `${openNegativeReviews} negative review(s) still waiting on a reply. Every one is a public conversion risk.`
        : null,
  },
  {
    key: 'low_rating',
    severity: 'warning',
    points: 6,
    title: 'Rating below 4.0',
    evaluate: ({ avgRating, totalReviews }) =>
      totalReviews > 0 && avgRating > 0 && avgRating < 4 ? `Average rating is ${avgRating.toFixed(1)} across ${totalReviews} reviews.` : null,
  },
  {
    key: 'duplicate_listing',
    severity: 'critical',
    points: 10,
    title: 'Possible duplicate listing',
    evaluate: ({ duplicateSuspects = 0 }) =>
      duplicateSuspects > 0 ? `${duplicateSuspects} other profile(s) share this name in the same city. Duplicates split ranking signals.` : null,
  },
  {
    key: 'no_store_code',
    severity: 'info',
    points: 2,
    title: 'No store code',
    evaluate: ({ location }) => (location.store_code ? null : 'A store code keeps bulk operations and reporting unambiguous.'),
  },
];

export function evaluateAudit(input: AuditInput): AuditResult {
  const findings: AuditFinding[] = [];
  for (const rule of AUDIT_RULES) {
    const detail = rule.evaluate(input);
    if (detail) {
      findings.push({ rule_key: rule.key, severity: rule.severity, title: rule.title, detail, points_lost: rule.points });
    }
  }

  const lost = findings.reduce((sum, f) => sum + f.points_lost, 0);
  const score = Math.max(0, Math.min(100, 100 - lost));
  const ranked = [...findings].sort((a, b) => b.points_lost - a.points_lost);

  return {
    score,
    band: score >= 85 ? 'healthy' : score >= 65 ? 'attention' : 'critical',
    findings,
    topFix: ranked[0] ?? null,
  };
}

export function scoreBand(score: number): 'healthy' | 'attention' | 'critical' {
  return score >= 85 ? 'healthy' : score >= 65 ? 'attention' : 'critical';
}

/** Portfolio-level view of the same rules: which fixes move the most points. */
export function portfolioFixRanking(results: AuditResult[]): { rule_key: string; title: string; locations: number; points: number }[] {
  const map = new Map<string, { rule_key: string; title: string; locations: number; points: number }>();
  for (const result of results) {
    for (const finding of result.findings) {
      const entry = map.get(finding.rule_key) ?? {
        rule_key: finding.rule_key,
        title: finding.title,
        locations: 0,
        points: 0,
      };
      entry.locations += 1;
      entry.points += finding.points_lost;
      map.set(finding.rule_key, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.points - a.points || b.locations - a.locations);
}

export function weeklyCoverage(hours: Location['hours']): { covered: Weekday[]; missing: Weekday[] } {
  const missing = missingDays(hours);
  return { covered: WEEKDAYS.filter((d) => !missing.includes(d)), missing };
}
