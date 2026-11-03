-- Kendra — local presence management for multi-location brands
-- Migration 1/3: types, tables, indexes, triggers

-- ============================================================ types
create type member_role as enum ('owner', 'admin', 'member', 'viewer');
create type location_status as enum ('active', 'paused', 'pending_sync', 'disconnected');
create type review_status as enum ('new', 'drafted', 'replied', 'ignored', 'escalated');
create type review_sentiment as enum ('positive', 'neutral', 'negative');
create type job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type job_kind as enum ('hours', 'attributes', 'description', 'photos', 'posts', 'sync');
create type severity_level as enum ('info', 'warning', 'critical');

-- ============================================================ identity
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 2 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  plan        text not null default 'growth' check (plan in ('trial', 'growth', 'scale', 'enterprise')),
  seat_limit  int  not null default 5 check (seat_limit > 0),
  brand_color text not null default '#0E5B46' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table memberships (
  org_id     uuid not null references organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on memberships (user_id);

-- ============================================================ locations
create table locations (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations (id) on delete cascade,
  name              text not null check (char_length(trim(name)) > 0),
  store_code        text,
  gbp_account_id    text,
  gbp_location_id   text,
  address_line1     text,
  city              text,
  state             text,
  postal_code       text,
  country           text not null default 'IN',
  phone             text,
  website           text,
  primary_category  text,
  additional_categories text[] not null default '{}',
  description       text,
  hours             jsonb not null default '{}'::jsonb,
  attributes        jsonb not null default '{}'::jsonb,
  status            location_status not null default 'active',
  photo_count       int not null default 0 check (photo_count >= 0),
  last_photo_at     timestamptz,
  last_synced_at    timestamptz,
  audit_score       int not null default 0 check (audit_score between 0 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, gbp_location_id)
);
create index locations_org_idx on locations (org_id, status);
create index locations_city_idx on locations (org_id, city);

-- ============================================================ reviews
create table reviews (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations (id) on delete cascade,
  location_id    uuid not null references locations (id) on delete cascade,
  gbp_review_id  text not null,
  author_name    text not null,
  rating         int  not null check (rating between 1 and 5),
  comment        text,
  language       text,
  sentiment      review_sentiment not null default 'neutral',
  status         review_status not null default 'new',
  draft_text     text,
  draft_source   text check (draft_source in ('ai', 'rule', 'human')),
  reply_text     text,
  replied_at     timestamptz,
  replied_by     uuid references auth.users (id),
  published_at   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  unique (location_id, gbp_review_id)
);
create index reviews_org_status_idx on reviews (org_id, status, published_at desc);
create index reviews_location_idx on reviews (location_id, published_at desc);

-- ============================================================ bulk operations
create table bulk_jobs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  kind         job_kind not null,
  status       job_status not null default 'queued',
  payload      jsonb not null default '{}'::jsonb,
  total        int not null default 0,
  succeeded    int not null default 0,
  failed       int not null default 0,
  error        text,
  created_by   uuid references auth.users (id),
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index bulk_jobs_org_idx on bulk_jobs (org_id, created_at desc);

create table bulk_job_items (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references bulk_jobs (id) on delete cascade,
  org_id      uuid not null references organizations (id) on delete cascade,
  location_id uuid not null references locations (id) on delete cascade,
  status      job_status not null default 'queued',
  error       text,
  created_at  timestamptz not null default now(),
  unique (job_id, location_id)
);

-- ============================================================ reporting
create table metric_snapshots (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations (id) on delete cascade,
  location_id        uuid not null references locations (id) on delete cascade,
  captured_on        date not null,
  views              int not null default 0,
  searches           int not null default 0,
  calls              int not null default 0,
  direction_requests int not null default 0,
  website_clicks     int not null default 0,
  photo_views        int not null default 0,
  avg_rating         numeric(3, 2) not null default 0,
  review_count       int not null default 0,
  created_at         timestamptz not null default now(),
  unique (location_id, captured_on)
);
create index metric_snapshots_org_date_idx on metric_snapshots (org_id, captured_on desc);

create table rank_snapshots (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  location_id uuid not null references locations (id) on delete cascade,
  keyword     text not null,
  captured_on date not null,
  position    int not null check (position >= 0),
  grid        jsonb,
  created_at  timestamptz not null default now(),
  unique (location_id, keyword, captured_on)
);
create index rank_snapshots_org_idx on rank_snapshots (org_id, captured_on desc);

create table audit_findings (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  location_id uuid not null references locations (id) on delete cascade,
  rule_key    text not null,
  severity    severity_level not null default 'warning',
  title       text not null,
  detail      text,
  points_lost int not null default 0,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (location_id, rule_key)
);
create index audit_findings_org_idx on audit_findings (org_id, resolved, severity);

-- ============================================================ audit trail
create table activity_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  location_id uuid references locations (id) on delete set null,
  actor_id    uuid references auth.users (id) on delete set null,
  kind        text not null,
  summary     text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index activity_events_org_idx on activity_events (org_id, created_at desc);

-- ============================================================ connections
create table connections (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations (id) on delete cascade,
  provider            text not null default 'google_business_profile',
  external_account_id text,
  display_name        text,
  status              text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error', 'expired')),
  connected_by        uuid references auth.users (id) on delete set null,
  connected_at        timestamptz,
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  unique (org_id, provider)
);

-- OAuth tokens live here. RLS is enabled with NO policies: only the
-- service role (Edge Functions) can ever read or write this table.
create table connection_secrets (
  connection_id    uuid primary key references connections (id) on delete cascade,
  org_id           uuid not null references organizations (id) on delete cascade,
  access_token     text not null,
  refresh_token    text,
  token_expires_at timestamptz,
  updated_at       timestamptz not null default now()
);

-- ============================================================ triggers
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at before update on organizations
  for each row execute function set_updated_at();
create trigger locations_set_updated_at before update on locations
  for each row execute function set_updated_at();

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
