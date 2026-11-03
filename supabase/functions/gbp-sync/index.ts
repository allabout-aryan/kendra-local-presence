// Supabase Edge Function: gbp-sync
// Pulls accounts, locations and reviews from the Google Business Profile API
// and reconciles them into the database. Scheduled hourly by pg_cron.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const GBP = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const GBP_REVIEWS = 'https://mybusiness.googleapis.com/v4';
const READ_MASK = 'name,title,storeCode,phoneNumbers,storefrontAddress,websiteUri,categories,profile,regularHours,openInfo,metadata';

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) throw new Error(`token refresh failed: ${response.status}`);
  return (await response.json()) as { access_token: string; expires_in: number };
}

function toHours(regularHours: { periods?: { openDay: string; openTime?: { hours?: number; minutes?: number }; closeDay: string; closeTime?: { hours?: number; minutes?: number } }[] }) {
  const dayMap: Record<string, string> = {
    MONDAY: 'mon', TUESDAY: 'tue', WEDNESDAY: 'wed', THURSDAY: 'thu', FRIDAY: 'fri', SATURDAY: 'sat', SUNDAY: 'sun',
  };
  const pad = (value?: number) => String(value ?? 0).padStart(2, '0');
  const hours: Record<string, { open: string; close: string } | null> = {};
  for (const period of regularHours.periods ?? []) {
    const day = dayMap[period.openDay];
    if (!day) continue;
    hours[day] = {
      open: `${pad(period.openTime?.hours)}:${pad(period.openTime?.minutes)}`,
      close: `${pad(period.closeTime?.hours)}:${pad(period.closeTime?.minutes)}`,
    };
  }
  return hours;
}

Deno.serve(async (request) => {
  const orgId = new URL(request.url).searchParams.get('org_id');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: connections, error: connectionError } = orgId
    ? await admin.from('connections').select('id, org_id').eq('org_id', orgId).eq('status', 'connected')
    : await admin.from('connections').select('id, org_id').eq('status', 'connected');

  if (connectionError) return new Response(JSON.stringify({ error: connectionError.message }), { status: 500 });

  const summary: Record<string, unknown>[] = [];

  for (const connection of connections ?? []) {
    const { data: secret } = await admin
      .from('connection_secrets')
      .select('access_token, refresh_token, token_expires_at')
      .eq('connection_id', connection.id)
      .maybeSingle();

    if (!secret) continue;

    let accessToken = secret.access_token as string;
    const expiresAt = secret.token_expires_at ? new Date(secret.token_expires_at).getTime() : 0;

    if (expiresAt && expiresAt - Date.now() < 120_000 && secret.refresh_token) {
      const refreshed = await refreshAccessToken(secret.refresh_token as string);
      accessToken = refreshed.access_token;
      await admin
        .from('connection_secrets')
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('connection_id', connection.id);
    }

    const headers = { Authorization: `Bearer ${accessToken}` };

    // 1. accounts -> locations
    const accountsResponse = await fetch(`${GBP}/accounts`, { headers });
    if (!accountsResponse.ok) {
      await admin.from('connections').update({ status: 'error' }).eq('id', connection.id);
      summary.push({ org: connection.org_id, error: `accounts ${accountsResponse.status}` });
      continue;
    }
    const accounts = (await accountsResponse.json()) as { accounts?: { name: string; accountName: string }[] };

    let synced = 0;
    for (const account of accounts.accounts ?? []) {
      const locationsResponse = await fetch(
        `${GBP}/${account.name}/locations?readMask=${encodeURIComponent(READ_MASK)}&pageSize=100`,
        { headers },
      );
      if (!locationsResponse.ok) continue;
      const locations = (await locationsResponse.json()) as { locations?: Record<string, unknown>[] };

      for (const location of locations.locations ?? []) {
        const address = (location.storefrontAddress ?? {}) as { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string };
        const profile = (location.profile ?? {}) as { description?: string };
        const categories = (location.categories ?? {}) as { primaryCategory?: { displayName?: string }; additionalCategories?: { displayName?: string }[] };
        const phoneNumbers = (location.phoneNumbers ?? {}) as { primaryPhone?: string };
        const metadata = (location.metadata ?? {}) as { mapsUri?: string };

        const payload = {
          org_id: connection.org_id,
          gbp_account_id: account.name,
          gbp_location_id: String(location.name ?? ''),
          name: String(location.title ?? 'Unnamed outlet'),
          store_code: (location.storeCode as string) ?? null,
          address_line1: address.addressLines?.[0] ?? null,
          city: address.locality ?? null,
          state: address.administrativeArea ?? null,
          postal_code: address.postalCode ?? null,
          phone: phoneNumbers.primaryPhone ?? null,
          website: (location.websiteUri as string) ?? null,
          primary_category: categories.primaryCategory?.displayName ?? null,
          additional_categories: (categories.additionalCategories ?? []).map((category) => category.displayName).filter(Boolean),
          description: profile.description ?? null,
          hours: toHours((location.regularHours ?? {}) as Parameters<typeof toHours>[0]),
          status: 'active',
          last_synced_at: new Date().toISOString(),
        };

        const { error: upsertError } = await admin
          .from('locations')
          .upsert(payload, { onConflict: 'org_id,gbp_location_id' });
        if (upsertError) {
          console.error('location upsert failed', upsertError.message);
          continue;
        }
        synced += 1;

        // 2. reviews for this location
        const reviewsResponse = await fetch(`${GBP_REVIEWS}/${location.name}/reviews?pageSize=50`, { headers });
        if (!reviewsResponse.ok) continue;
        const reviewPayload = (await reviewsResponse.json()) as {
          reviews?: { reviewId: string; starRating: string; comment?: string; createTime: string; reviewer?: { displayName?: string } }[];
        };

        const stars: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
        for (const review of reviewPayload.reviews ?? []) {
          const rating = stars[review.starRating] ?? 3;
          await admin.from('reviews').upsert(
            {
              org_id: connection.org_id,
              location_id: (await admin.from('locations').select('id').eq('org_id', connection.org_id).eq('gbp_location_id', payload.gbp_location_id).single()).data?.id,
              gbp_review_id: review.reviewId,
              author_name: review.reviewer?.displayName ?? 'Google user',
              rating,
              comment: review.comment ?? null,
              sentiment: rating <= 2 ? 'negative' : rating >= 4 ? 'positive' : 'neutral',
              published_at: review.createTime,
            },
            { onConflict: 'location_id,gbp_review_id', ignoreDuplicates: true },
          );
        }
      }
    }

    await admin
      .from('connections')
      .update({ status: 'connected', last_synced_at: new Date().toISOString() })
      .eq('id', connection.id);

    await admin.from('activity_events').insert({
      org_id: connection.org_id,
      kind: 'sync.completed',
      summary: `Synced ${synced} outlet(s) from Google Business Profile`,
      meta: { locations: synced },
    });

    summary.push({ org: connection.org_id, locations: synced });
  }

  return new Response(JSON.stringify({ ok: true, summary }), { headers: { 'Content-Type': 'application/json' } });
});
