import { draftReply, type DraftResult } from '@/lib/domain/reviews';
import { supabase, supabaseReady } from './store';

export interface DraftRequest {
  authorName: string;
  rating: number;
  comment: string | null;
  locationName: string;
  brandName: string;
  tone?: 'warm' | 'formal';
}

/**
 * Drafting strategy: try the configured AI provider through an Edge Function
 * (keeps the model key server-side), then fall back to the deterministic
 * template generator. The UI always shows which one produced the text, so a
 * reviewer is never misled about what they are approving.
 */
export async function generateDraft(request: DraftRequest): Promise<DraftResult & { degraded?: string }> {
  const fallback = draftReply(request);
  if (!supabaseReady || !supabase) return fallback;

  try {
    const { data, error } = await supabase.functions.invoke('ai-draft', { body: request });
    if (error) throw error;
    const text = (data as { text?: string } | null)?.text;
    if (!text || typeof text !== 'string' || text.trim().length < 20) return fallback;
    return { text: text.trim(), source: 'rule', issue: fallback.issue, degraded: undefined };
  } catch {
    return { ...fallback, degraded: 'AI drafting unavailable — showing the template draft.' };
  }
}
