-- Migration 4/4: schedule the sync worker with pg_cron + pg_net.
-- Applied after the Edge Function `gbp-sync` is deployed.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Hourly sync of every connected org. The service role key is read from Vault,
-- never stored in this migration.
select cron.schedule(
  'kendra-gbp-sync',
  '17 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/gbp-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
