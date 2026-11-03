-- Migration: audit history, GBP posts, CSV import jobs
-- Adds the data the advanced surfaces need without touching the v1 schema.

create type post_status as enum ('draft', 'scheduled', 'published', 'failed');
create type import_status as enum ('queued', 'previewed', 'running', 'completed', 'failed');

-- ============================================================ audit history
-- One row per outlet per day so the portfolio score has a trend, not a number.
create table audit_snapshots (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  location_id uuid not null references locations (id) on delete cascade,
  captured_on date not null,
  score       int  not null check (score between 0 and 100),
  findings    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  unique (location_id, captured_on)
);
create index audit_snapshots_org_idx on audit_snapshots (org_id, captured_on desc);

-- ============================================================ GBP posts
create table posts (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations (id) on delete cascade,
  location_id  uuid not null references locations (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 1500),
  cta_type     text check (cta_type in ('none', 'call', 'book', 'order', 'shop', 'learn_more', 'sign_up')),
  cta_url      text,
  scheduled_for timestamptz,
  status       post_status not null default 'draft',
  published_at timestamptz,
  error        text,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index posts_org_idx on posts (org_id, status, scheduled_for desc);

create trigger posts_set_updated_at before update on posts
  for each row execute function set_updated_at();

-- ============================================================ CSV imports
create table import_jobs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations (id) on delete cascade,
  filename    text,
  status      import_status not null default 'queued',
  total_rows  int not null default 0,
  imported    int not null default 0,
  failed      int not null default 0,
  errors      jsonb not null default '[]'::jsonb,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index import_jobs_org_idx on import_jobs (org_id, created_at desc);

-- ============================================================ RLS
alter table audit_snapshots enable row level security;
alter table posts           enable row level security;
alter table import_jobs     enable row level security;

do $$
declare
  t text;
  writable text[] := array['audit_snapshots','posts','import_jobs'];
begin
  foreach t in array writable loop
    execute format('create policy %1$s_select on %1$s for select to authenticated using (is_member(org_id));', t);
    execute format('create policy %1$s_insert on %1$s for insert to authenticated with check (has_role(org_id, array[''owner'',''admin'',''member'']::member_role[]));', t);
    execute format('create policy %1$s_update on %1$s for update to authenticated using (has_role(org_id, array[''owner'',''admin'',''member'']::member_role[])) with check (has_role(org_id, array[''owner'',''admin'',''member'']::member_role[]));', t);
    execute format('create policy %1$s_delete on %1$s for delete to authenticated using (has_role(org_id, array[''owner'',''admin'']::member_role[]));', t);
  end loop;
end;
$$;

grant select, insert, update, delete on audit_snapshots, posts, import_jobs to authenticated;
revoke all on audit_snapshots, posts, import_jobs from anon;

-- ============================================================ reporting view
create or replace view v_score_trend with (security_invoker = true) as
select
  s.org_id,
  s.captured_on,
  round(avg(s.score)::numeric, 1) as avg_score,
  count(*)::int as outlets
from audit_snapshots s
group by s.org_id, s.captured_on;
