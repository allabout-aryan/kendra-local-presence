-- Migration 3/3: row level security, grants, defence in depth

alter table profiles            enable row level security;
alter table organizations       enable row level security;
alter table memberships         enable row level security;
alter table locations           enable row level security;
alter table reviews             enable row level security;
alter table bulk_jobs           enable row level security;
alter table bulk_job_items      enable row level security;
alter table metric_snapshots    enable row level security;
alter table rank_snapshots      enable row level security;
alter table audit_findings      enable row level security;
alter table activity_events     enable row level security;
alter table connections         enable row level security;
alter table connection_secrets  enable row level security;

-- ============================================================ profiles
create policy profiles_select on profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from memberships mine
      join memberships theirs on theirs.org_id = mine.org_id
      where mine.user_id = auth.uid() and theirs.user_id = profiles.id
    )
  );
create policy profiles_insert_self on profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ============================================================ organizations
create policy organizations_select on organizations for select to authenticated
  using (is_member(id));
create policy organizations_update on organizations for update to authenticated
  using (has_role(id, array['owner','admin']::member_role[]))
  with check (has_role(id, array['owner','admin']::member_role[]));
-- no insert/delete policy: created through create_organization(), removed by service role.

-- ============================================================ memberships
create policy memberships_select on memberships for select to authenticated
  using (is_member(org_id));
create policy memberships_insert on memberships for insert to authenticated
  with check (has_role(org_id, array['owner','admin']::member_role[]));
create policy memberships_update on memberships for update to authenticated
  using (has_role(org_id, array['owner']::member_role[]))
  with check (has_role(org_id, array['owner']::member_role[]));
create policy memberships_delete on memberships for delete to authenticated
  using (has_role(org_id, array['owner','admin']::member_role[]));

-- ============================================================ org-scoped tables
-- read for every member, write for owner/admin/member, delete for owner/admin.
do $$
declare
  t text;
  writable text[] := array['locations','reviews','bulk_jobs','bulk_job_items','metric_snapshots','rank_snapshots','audit_findings','activity_events','connections'];
begin
  foreach t in array writable loop
    execute format(
      'create policy %1$s_select on %1$s for select to authenticated using (is_member(org_id));', t);
    execute format(
      'create policy %1$s_insert on %1$s for insert to authenticated with check (has_role(org_id, array[''owner'',''admin'',''member'']::member_role[]));', t);
    execute format(
      'create policy %1$s_update on %1$s for update to authenticated using (has_role(org_id, array[''owner'',''admin'',''member'']::member_role[])) with check (has_role(org_id, array[''owner'',''admin'',''member'']::member_role[]));', t);
    execute format(
      'create policy %1$s_delete on %1$s for delete to authenticated using (has_role(org_id, array[''owner'',''admin'']::member_role[]));', t);
  end loop;
end;
$$;

-- ============================================================ secrets
-- connection_secrets has RLS enabled and deliberately NO policies.
-- Nothing but the service role (Edge Functions) can touch it.

-- ============================================================ grants
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all sequences in schema public to authenticated;
revoke all on connection_secrets from anon, authenticated;
revoke all on public.profiles from anon;
revoke all on public.organizations from anon;
revoke all on public.memberships from anon;
revoke all on public.locations from anon;
revoke all on public.reviews from anon;
revoke all on public.bulk_jobs from anon;
revoke all on public.bulk_job_items from anon;
revoke all on public.metric_snapshots from anon;
revoke all on public.rank_snapshots from anon;
revoke all on public.audit_findings from anon;
revoke all on public.activity_events from anon;
revoke all on public.connections from anon;

grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.add_member_by_email(uuid, text, member_role) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
revoke execute on function public.create_organization(text, text) from anon;
revoke execute on function public.add_member_by_email(uuid, text, member_role) from anon;
revoke execute on function public.remove_member(uuid, uuid) from anon;
