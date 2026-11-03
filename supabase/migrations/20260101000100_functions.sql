-- Migration 2/3: authorization helpers, RPCs, reporting views

-- ============================================================ authz helpers
-- security definer + fixed search_path so policies cannot recurse or be hijacked.
create or replace function public.is_member(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.org_id = target_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_role(target_org uuid, allowed member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships m
    where m.org_id = target_org and m.user_id = auth.uid() and m.role = any(allowed)
  );
$$;

create or replace function public.my_role(target_org uuid)
returns member_role language sql stable security definer set search_path = public as $$
  select m.role from memberships m
  where m.org_id = target_org and m.user_id = auth.uid();
$$;

-- ============================================================ bootstrap
-- Creating the first org is a chicken-and-egg problem under RLS: you need a
-- membership to read an org, and an org to hold the membership. This RPC
-- (security definer, authenticated callers only) breaks the loop atomically.
create or replace function public.create_organization(org_name text, org_slug text default null)
returns organizations language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  base_slug text;
  candidate text;
  attempt int := 0;
  created organizations;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if org_name is null or char_length(trim(org_name)) < 2 then
    raise exception 'organization_name_too_short' using errcode = '22023';
  end if;

  base_slug := coalesce(nullif(trim(org_slug), ''), lower(trim(org_name)));
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'brand'; end if;
  base_slug := left(base_slug, 40);

  candidate := base_slug;
  loop
    exit when not exists (select 1 from organizations o where o.slug = candidate);
    attempt := attempt + 1;
    if attempt > 50 then
      raise exception 'slug_unavailable' using errcode = '23505';
    end if;
    candidate := base_slug || '-' || attempt::text;
  end loop;

  insert into organizations (name, slug, created_by)
  values (trim(org_name), candidate, uid)
  returning * into created;

  insert into memberships (org_id, user_id, role) values (created.id, uid, 'owner');

  insert into activity_events (org_id, actor_id, kind, summary, meta)
  values (created.id, uid, 'org.created', 'Workspace created', jsonb_build_object('slug', candidate));

  return created;
end;
$$;

-- ============================================================ team management
create or replace function public.add_member_by_email(target_org uuid, invitee_email text, new_role member_role default 'member')
returns memberships language plpgsql security definer set search_path = public as $$
declare
  invitee uuid;
  created memberships;
  seats_used int;
  seat_cap int;
begin
  if not has_role(target_org, array['owner','admin']::member_role[]) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select id into invitee from auth.users where lower(email) = lower(trim(invitee_email));
  if invitee is null then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  select seat_limit into seat_cap from organizations where id = target_org;
  select count(*) into seats_used from memberships where org_id = target_org;

  if exists (select 1 from memberships where org_id = target_org and user_id = invitee) then
    raise exception 'already_a_member' using errcode = '23505';
  end if;
  if seats_used >= seat_cap then
    raise exception 'seat_limit_reached' using errcode = '22000';
  end if;

  insert into memberships (org_id, user_id, role) values (target_org, invitee, new_role)
  returning * into created;

  insert into activity_events (org_id, actor_id, kind, summary, meta)
  values (target_org, auth.uid(), 'member.added', 'Team member added',
          jsonb_build_object('role', new_role, 'email', invitee_email));

  return created;
end;
$$;

create or replace function public.remove_member(target_org uuid, member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  target_role member_role;
begin
  if not has_role(target_org, array['owner','admin']::member_role[]) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select role into target_role from memberships where org_id = target_org and user_id = member_id;
  if target_role is null then
    raise exception 'not_a_member' using errcode = 'P0002';
  end if;
  if target_role = 'owner' then
    raise exception 'cannot_remove_owner' using errcode = '22000';
  end if;

  delete from memberships where org_id = target_org and user_id = member_id;

  insert into activity_events (org_id, actor_id, kind, summary)
  values (target_org, auth.uid(), 'member.removed', 'Team member removed');
end;
$$;

-- ============================================================ reporting views
create or replace view v_location_health with (security_invoker = true) as
select
  l.id, l.org_id, l.name, l.store_code, l.city, l.state, l.status,
  l.audit_score, l.photo_count, l.last_synced_at, l.primary_category,
  coalesce(rv.open_reviews, 0)::int as open_reviews,
  coalesce(rv.negative_open, 0)::int as negative_open,
  coalesce(rv.total_reviews, 0)::int as total_reviews,
  coalesce(rv.avg_rating, 0)::numeric(3,2) as avg_rating,
  coalesce(s.calls, 0)::int as calls_30d,
  coalesce(s.direction_requests, 0)::int as directions_30d,
  coalesce(s.views, 0)::int as views_30d,
  coalesce(s.searches, 0)::int as searches_30d,
  coalesce(s.website_clicks, 0)::int as website_clicks_30d,
  s.captured_on as metrics_captured_on
from locations l
left join lateral (
  select
    count(*) filter (where status in ('new','drafted','escalated')) as open_reviews,
    count(*) filter (where status in ('new','drafted','escalated') and sentiment = 'negative') as negative_open,
    count(*) as total_reviews,
    round(avg(rating)::numeric, 2) as avg_rating
  from reviews r where r.location_id = l.id
) rv on true
left join lateral (
  select
    sum(calls) as calls, sum(direction_requests) as direction_requests,
    sum(views) as views, sum(searches) as searches,
    sum(website_clicks) as website_clicks, max(captured_on) as captured_on
  from metric_snapshots m
  where m.location_id = l.id and m.captured_on >= current_date - interval '30 days'
) s on true;

create or replace view v_review_queue with (security_invoker = true) as
select
  r.id, r.org_id, r.location_id, r.author_name, r.rating, r.comment, r.sentiment,
  r.status, r.draft_text, r.draft_source, r.reply_text, r.replied_at, r.published_at,
  l.name as location_name, l.city as location_city
from reviews r
join locations l on l.id = r.location_id;

create or replace view v_portfolio_rollup with (security_invoker = true) as
select
  o.id as org_id,
  count(distinct l.id)::int as locations_total,
  count(distinct l.id) filter (where l.status = 'active')::int as locations_active,
  coalesce(round(avg(l.audit_score)::numeric, 1), 0) as avg_audit_score,
  coalesce(min(l.audit_score), 0)::int as min_audit_score,
  coalesce(sum(h.open_reviews), 0)::int as open_reviews,
  coalesce(sum(h.negative_open), 0)::int as negative_open_reviews,
  coalesce(round(avg(h.avg_rating)::numeric, 2), 0) as avg_rating,
  coalesce(sum(h.calls_30d), 0)::int as calls_30d,
  coalesce(sum(h.directions_30d), 0)::int as directions_30d,
  coalesce(sum(h.views_30d), 0)::int as views_30d,
  coalesce(max(h.last_synced_at), null) as last_synced_at
from organizations o
left join locations l on l.org_id = o.id
left join v_location_health h on h.id = l.id
group by o.id;
