import type { Sentiment } from './types';

const NEGATIVE_SIGNALS = [
  'waited', 'waiting', 'rude', 'unprofessional', 'dirty', 'unhygienic', 'cold', 'stale',
  'overpriced', 'expensive', 'refund', 'broken', 'damaged', 'late', 'delay', 'ignored',
  'no response', 'never received', 'worst', 'disappointed', 'cancelled', 'leak', 'smell',
];

const POSITIVE_SIGNALS = [
  'great', 'excellent', 'helpful', 'friendly', 'clean', 'quick', 'love', 'perfect',
  'recommend', 'amazing', 'smooth', 'best', 'prompt',
];

export function classifySentiment(rating: number, comment: string | null): Sentiment {
  const text = (comment ?? '').toLowerCase();
  const negativeHits = NEGATIVE_SIGNALS.filter((word) => text.includes(word)).length;
  const positiveHits = POSITIVE_SIGNALS.filter((word) => text.includes(word)).length;

  if (rating <= 2) return 'negative';
  if (rating >= 4) {
    // A 4–5 star review can still carry a complaint; treat it as neutral so it
    // lands in the queue rather than being auto-archived.
    return negativeHits > 0 ? 'neutral' : 'positive';
  }
  if (negativeHits > positiveHits) return 'negative';
  if (positiveHits > negativeHits) return 'positive';
  return 'neutral';
}

export interface IssueMatch {
  key: string;
  label: string;
  acknowledgement: string;
}

const ISSUES: { key: string; label: string; words: string[]; acknowledgement: string }[] = [
  {
    key: 'wait_time',
    label: 'wait time',
    words: ['waited', 'waiting', 'queue', 'slow', 'late', 'delay', 'delayed', 'took forever'],
    acknowledgement: 'the wait you had to sit through',
  },
  {
    key: 'staff',
    label: 'staff behaviour',
    words: ['rude', 'unprofessional', 'staff', 'behaviour', 'behavior', 'ignored', 'arrogant'],
    acknowledgement: 'the way our team came across',
  },
  {
    key: 'cleanliness',
    label: 'cleanliness',
    words: ['dirty', 'unhygienic', 'clean', 'smell', 'hygiene', 'sticky'],
    acknowledgement: 'the condition of the store when you visited',
  },
  {
    key: 'pricing',
    label: 'pricing',
    words: ['overpriced', 'expensive', 'price', 'costly', 'bill', 'charged'],
    acknowledgement: 'the value you felt you got for what you paid',
  },
  {
    key: 'product_quality',
    label: 'product quality',
    words: ['cold', 'stale', 'broken', 'damaged', 'quality', 'tasteless', 'leak', 'defective'],
    acknowledgement: 'the quality of what you were served',
  },
  {
    key: 'availability',
    label: 'availability',
    words: ['out of stock', 'unavailable', 'not available', 'sold out', 'no stock'],
    acknowledgement: 'not having what you came in for',
  },
  {
    key: 'refund',
    label: 'refund or billing',
    words: ['refund', 'return', 'billing', 'double charged', 'invoice'],
    acknowledgement: 'the trouble with your billing',
  },
  {
    key: 'parking',
    label: 'parking and access',
    words: ['parking', 'hard to find', 'location', 'directions', 'entrance'],
    acknowledgement: 'how hard the outlet was to reach',
  },
];

export function detectIssue(comment: string | null): IssueMatch | null {
  if (!comment) return null;
  const text = comment.toLowerCase();
  const scored = ISSUES.map((issue) => ({
    issue,
    score: issue.words.filter((word) => text.includes(word)).length,
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best) return null;
  return { key: best.issue.key, label: best.issue.label, acknowledgement: best.issue.acknowledgement };
}

export interface DraftContext {
  authorName: string;
  rating: number;
  comment: string | null;
  locationName: string;
  brandName: string;
  reviewerLanguage?: string | null;
}

export interface DraftResult {
  text: string;
  source: 'rule';
  issue: string | null;
}

const FIRST_NAME = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Deterministic first-draft generator. It is the fallback when no AI provider is
 * configured, and the safety net when one fails — so it must never promise a
 * refund, never invent a fact, and never sound like a form letter.
 */
export function draftReply(ctx: DraftContext): DraftResult {
  const name = FIRST_NAME(ctx.authorName);
  const issue = detectIssue(ctx.comment);
  const place = ctx.locationName;

  if (ctx.rating >= 4) {
    const opener = ctx.rating === 5 ? `Thank you, ${name} — this made our day.` : `Thanks for taking the time, ${name}.`;
    const middle = issue
      ? ` We have noted your point about ${issue.acknowledgement} and are looking at it.`
      : ` Glad the team at ${place} looked after you well.`;
    return {
      text: `${opener}${middle} We would love to see you again at ${place} soon.\n\n— Team ${ctx.brandName}`,
      source: 'rule',
      issue: issue?.key ?? null,
    };
  }

  if (ctx.rating === 3) {
    const middle = issue
      ? `You have flagged ${issue.acknowledgement}, and that is not the experience we want to be known for.`
      : `It sounds like the visit was fine but not memorable, and we would like to change that.`;
    return {
      text: `Thanks for the honest feedback, ${name}. ${middle} I have shared this with the ${place} team so we can tighten things up. If you give us another chance, please ask for the store manager and we will make sure you are looked after.\n\n— Team ${ctx.brandName}`,
      source: 'rule',
      issue: issue?.key ?? null,
    };
  }

  const middle = issue
    ? `What you describe with ${issue.acknowledgement} is not how we want to run ${place}.`
    : `This is not the standard we hold ourselves to at ${place}.`;
  return {
    text: `${name}, I am sorry — ${middle.charAt(0).toLowerCase()}${middle.slice(1)} I have passed your review to the store manager and we are reviewing what happened on the day. If you are willing, please call the outlet and ask for the manager so we can put this right directly.\n\n— Team ${ctx.brandName}`,
    source: 'rule',
    issue: issue?.key ?? null,
  };
}

export function isReplySafe(text: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (text.trim().length < 20) problems.push('Reply is too short to be useful.');
  if (text.length > 1200) problems.push('Reply exceeds the 1,200 character limit Google accepts comfortably.');
  if (/\b(refund guaranteed|we will refund|free of charge|100% guarantee)\b/i.test(text)) {
    problems.push('Avoid promising refunds or guarantees in a public reply.');
  }
  if (/\b(never|always)\b.*\b(happened|happens)\b/i.test(text)) {
    problems.push('Avoid absolute claims about what did or did not happen.');
  }
  return { ok: problems.length === 0, problems };
}
