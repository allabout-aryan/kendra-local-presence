// Supabase Edge Function: gbp-oauth-callback
// Exchanges a Google authorisation code for tokens and stores them where only
// the service role can read them. Never returns a token to the caller.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.1';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // the org id
  const error = url.searchParams.get('error');

  const redirectBack = (status: string) =>
    Response.redirect(`${Deno.env.get('APP_URL') ?? ''}/settings?google=${status}`, 302);

  if (error) return redirectBack('denied');
  if (!code || !state) return new Response('Missing code or state', { status: 400 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      redirect_uri: Deno.env.get('GOOGLE_OAUTH_REDIRECT_URL')!,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    console.error('token exchange failed', await tokenResponse.text());
    return redirectBack('failed');
  }

  const tokens = await tokenResponse.json();

  const { data: connection, error: connectionError } = await admin
    .from('connections')
    .upsert(
      {
        org_id: state,
        provider: 'google_business_profile',
        status: 'connected',
        connected_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,provider' },
    )
    .select()
    .single();

  if (connectionError || !connection) {
    console.error('connection upsert failed', connectionError);
    return redirectBack('failed');
  }

  const { error: secretError } = await admin.from('connection_secrets').upsert({
    connection_id: connection.id,
    org_id: state,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (secretError) {
    console.error('secret write failed', secretError);
    return redirectBack('failed');
  }

  await admin.from('activity_events').insert({
    org_id: state,
    kind: 'connection.connected',
    summary: 'Google Business Profile connected',
  });

  return redirectBack('connected');
});
