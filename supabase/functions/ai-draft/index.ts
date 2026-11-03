// Supabase Edge Function: ai-draft
// Turns a review into a first-draft reply using the configured provider.
// The model key never leaves the server; the browser calls this with the
// user's JWT and gets back text only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DraftRequest {
  authorName: string;
  rating: number;
  comment: string | null;
  locationName: string;
  brandName: string;
  tone?: 'warm' | 'formal';
}

const SYSTEM_PROMPT = `You draft replies to Google reviews on behalf of a multi-location Indian brand.
Rules:
- 3 to 5 sentences, under 700 characters.
- Address the reviewer by first name. Never invent facts about the visit.
- For 1-2 stars: apologise plainly, name the specific issue they raised, say it has gone to the store manager, invite them to contact the outlet.
- For 3 stars: thank them, acknowledge the gap, invite them back.
- For 4-5 stars: thank them warmly, mention the outlet, invite them back.
- Never promise refunds, discounts or compensation. Never make absolute claims.
- Plain English, no emoji, no hashtags, no marketing superlatives.
- Sign off with "— Team {brand}".`;

function prompt(input: DraftRequest): string {
  return [
    `Brand: ${input.brandName}`,
    `Outlet: ${input.locationName}`,
    `Reviewer: ${input.authorName}`,
    `Rating: ${input.rating}/5`,
    `Review: ${input.comment ?? '(no comment)'}`,
    `Tone: ${input.tone ?? 'warm'}`,
    'Write the reply now.',
  ].join('\n');
}

async function callProvider(input: DraftRequest): Promise<string | null> {
  const provider = Deno.env.get('AI_PROVIDER') ?? 'none';
  const apiKey = Deno.env.get('AI_API_KEY');
  if (provider === 'none' || !apiKey) return null;

  const endpoints: Record<string, { url: string; model: string }> = {
    openai: { url: 'https://api.openai.com/v1/chat/completions', model: Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini' },
    sarvam: { url: 'https://api.sarvam.ai/v1/chat/completions', model: Deno.env.get('AI_MODEL') ?? 'sarvam-m' },
  };
  const config = endpoints[provider];
  if (!config) return null;

  const response = await fetch(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.replace('{brand}', input.brandName) },
        { role: 'user', content: prompt(input) },
      ],
    }),
  });

  if (!response.ok) {
    console.error('ai-draft provider error', response.status, await response.text());
    return null;
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text.trim() : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = request.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userResult, error: authError } = await supabase.auth.getUser();
    if (authError || !userResult.user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS });
    }

    const input = (await request.json()) as DraftRequest;
    if (!input?.authorName || !input?.locationName || typeof input.rating !== 'number') {
      return new Response(JSON.stringify({ error: 'invalid_payload' }), { status: 400, headers: CORS });
    }

    const text = await callProvider(input);
    if (!text) {
      // The client falls back to its deterministic template draft.
      return new Response(JSON.stringify({ error: 'provider_unavailable' }), { status: 503, headers: CORS });
    }

    return new Response(JSON.stringify({ text, provider: Deno.env.get('AI_PROVIDER') }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('ai-draft failed', error);
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: CORS });
  }
});
