'use client';

import * as React from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityEvent, BulkJob, Connection, Location, MemberRole, Membership, MetricSnapshot,
  Organization, RankSnapshot, Review,
} from '@/lib/domain/types';
import type { BulkEditInput, LocationInput } from '@/lib/domain/validation';
import { applyHoursPatch } from '@/lib/domain/hours';
import { evaluateAudit } from '@/lib/domain/audit';
import { buildDemoDataset, type DemoDataset } from './demo';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseReady =
  /^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(SUPABASE_URL) && SUPABASE_ANON_KEY.length > 40;

export const supabase: SupabaseClient | null = supabaseReady
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

const DEMO_KEY = 'kendra.demo.workspace.v1';

export type Mode = 'supabase' | 'demo';

export interface SessionUser {
  id: string;
  email: string | null;
  name: string | null;
}

export interface OrgEntry {
  org: Organization;
  role: MemberRole;
}

export interface WorkspaceData {
  locations: Location[];
  reviews: Review[];
  metrics: MetricSnapshot[];
  ranks: RankSnapshot[];
  jobs: BulkJob[];
  activity: ActivityEvent[];
  members: Membership[];
  connection: Connection | null;
}

const EMPTY_DATA: WorkspaceData = {
  locations: [],
  reviews: [],
  metrics: [],
  ranks: [],
  jobs: [],
  activity: [],
  members: [],
  connection: null,
};

interface StoreValue {
  status: 'loading' | 'ready' | 'error';
  mode: Mode;
  error: string | null;
  user: SessionUser | null;
  orgs: OrgEntry[];
  org: Organization | null;
  role: MemberRole | null;
  data: WorkspaceData;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithOtp: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  enterDemo: () => void;
  createOrg: (name: string, slug?: string) => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
  saveLocation: (input: LocationInput, id?: string) => Promise<void>;
  deleteLocation: (id: string) => Promise<void>;
  bulkEdit: (input: BulkEditInput) => Promise<BulkJob>;
  replyReview: (reviewId: string, text: string, source: 'ai' | 'rule' | 'human') => Promise<void>;
  setReviewStatus: (reviewId: string, status: Review['status']) => Promise<void>;
  inviteMember: (email: string, role: MemberRole) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  updateOrg: (patch: Partial<Pick<Organization, 'name' | 'brand_color' | 'plan'>>) => Promise<void>;
  syncNow: (locationIds?: string[]) => Promise<void>;
}

const StoreContext = React.createContext<StoreValue | null>(null);

function readDemo(): DemoDataset {
  if (typeof window === 'undefined') return buildDemoDataset();
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDataset;
      if (parsed?.locations?.length) return parsed;
    }
  } catch {
    // corrupt local state should never block the app
  }
  return buildDemoDataset();
}

function writeDemo(dataset: DemoDataset) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(dataset));
  } catch {
    // quota errors are non-fatal for a demo workspace
  }
}

function demoToData(dataset: DemoDataset): WorkspaceData {
  return {
    locations: dataset.locations,
    reviews: dataset.reviews,
    metrics: dataset.metrics,
    ranks: dataset.ranks,
    jobs: dataset.jobs,
    activity: dataset.activity,
    members: dataset.members,
    connection: dataset.connection,
  };
}

export function KendraProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [mode, setMode] = React.useState<Mode>(supabaseReady ? 'supabase' : 'demo');
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [orgs, setOrgs] = React.useState<OrgEntry[]>([]);
  const [org, setOrg] = React.useState<Organization | null>(null);
  const [role, setRole] = React.useState<MemberRole | null>(null);
  const [data, setData] = React.useState<WorkspaceData>(EMPTY_DATA);
  const demoRef = React.useRef<DemoDataset | null>(null);

  const currentOrgId = React.useRef<string | null>(null);

  /* --------------------------------------------------------------- loading */

  const loadOrgData = React.useCallback(async (orgId: string) => {
    if (!supabase) return EMPTY_DATA;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString().slice(0, 10);

    const [locations, reviews, metrics, ranks, jobs, activity, members, connection] = await Promise.all([
      supabase.from('locations').select('*').eq('org_id', orgId).order('name'),
      supabase.from('v_review_queue').select('*').eq('org_id', orgId).order('published_at', { ascending: false }).limit(400),
      supabase.from('metric_snapshots').select('*').eq('org_id', orgId).gte('captured_on', sinceIso),
      supabase.from('rank_snapshots').select('*').eq('org_id', orgId).order('captured_on', { ascending: false }).limit(600),
      supabase.from('bulk_jobs').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(20),
      supabase.from('activity_events').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(60),
      supabase.from('memberships').select('org_id, user_id, role, created_at').eq('org_id', orgId),
      supabase.from('connections').select('*').eq('org_id', orgId).maybeSingle(),
    ]);

    const firstError = [locations, reviews, metrics, ranks, jobs, activity, members].find((r) => r.error)?.error;
    if (firstError) throw new Error(firstError.message);

    const memberRows = (members.error ? [] : members.data ?? []) as Membership[];
    let membersWithProfiles = memberRows;
    if (memberRows.length > 0) {
      const profiles = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberRows.map((m) => m.user_id));
      const byId = new Map((profiles.data ?? []).map((p) => [p.id as string, p]));
      membersWithProfiles = memberRows.map((m) => ({
        ...m,
        profile: {
          full_name: (byId.get(m.user_id)?.full_name as string | null) ?? null,
          email: (byId.get(m.user_id)?.email as string | null) ?? null,
        },
      }));
    }

    return {
      locations: (locations.data ?? []) as Location[],
      reviews: (reviews.data ?? []) as Review[],
      metrics: (metrics.data ?? []) as MetricSnapshot[],
      ranks: (ranks.data ?? []) as RankSnapshot[],
      jobs: (jobs.data ?? []) as BulkJob[],
      activity: (activity.data ?? []) as ActivityEvent[],
      members: membersWithProfiles,
      connection: (connection.data as Connection | null) ?? null,
    } satisfies WorkspaceData;
  }, []);

  const loadOrgs = React.useCallback(async (): Promise<OrgEntry[]> => {
    if (!supabase) return [];
    const { data: rows, error: membershipsError } = await supabase
      .from('memberships')
      .select('org_id, role, organizations(*)');
    if (membershipsError) throw new Error(membershipsError.message);
    return (rows ?? []).map((row) => ({
      org: row.organizations as unknown as Organization,
      role: row.role as MemberRole,
    }));
  }, []);

  const applyOrg = React.useCallback(
    async (entry: OrgEntry) => {
      currentOrgId.current = entry.org.id;
      setOrg(entry.org);
      setRole(entry.role);
      const loaded = await loadOrgData(entry.org.id);
      setData(loaded);
      if (typeof window !== 'undefined') window.localStorage.setItem('kendra.org', entry.org.id);
    },
    [loadOrgData],
  );

  const bootstrap = React.useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      if (mode === 'demo') {
        const dataset = readDemo();
        demoRef.current = dataset;
        setUser({ id: 'demo-user', email: 'aarti@bluetokai.test', name: 'Aarti Rao' });
        setOrgs([{ org: dataset.org, role: 'owner' }]);
        setOrg(dataset.org);
        setRole('owner');
        setData(demoToData(dataset));
        setStatus('ready');
        return;
      }

      if (!supabase) throw new Error('Supabase is not configured');
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setUser(null);
        setOrgs([]);
        setOrg(null);
        setRole(null);
        setData(EMPTY_DATA);
        setStatus('ready');
        return;
      }

      const sessionUser = session.session.user;
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', sessionUser.id).maybeSingle();
      setUser({
        id: sessionUser.id,
        email: sessionUser.email ?? null,
        name: (profile?.full_name as string | null) ?? sessionUser.email?.split('@')[0] ?? null,
      });

      const entries = await loadOrgs();
      setOrgs(entries);
      if (entries.length === 0) {
        setOrg(null);
        setRole(null);
        setData(EMPTY_DATA);
        setStatus('ready');
        return;
      }
      const remembered = typeof window !== 'undefined' ? window.localStorage.getItem('kendra.org') : null;
      const target = entries.find((entry) => entry.org.id === remembered) ?? entries[0];
      await applyOrg(target);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your workspace');
      setStatus('error');
    }
  }, [mode, loadOrgs, applyOrg]);

  React.useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  /* --------------------------------------------------------------- actions */

  const refresh = React.useCallback(async () => {
    if (mode === 'demo') {
      const dataset = readDemo();
      demoRef.current = dataset;
      setData(demoToData(dataset));
      setOrgs([{ org: dataset.org, role: 'owner' }]);
      setOrg(dataset.org);
      return;
    }
    if (!currentOrgId.current) return;
    setData(await loadOrgData(currentOrgId.current));
  }, [mode, loadOrgData]);

  const mutateDemo = React.useCallback((mutator: (dataset: DemoDataset) => DemoDataset) => {
    const current = demoRef.current ?? readDemo();
    const next = mutator(current);
    demoRef.current = next;
    writeDemo(next);
    setData(demoToData(next));
    setOrg(next.org);
    setOrgs([{ org: next.org, role: 'owner' }]);
  }, []);

  const signIn = React.useCallback(
    async (email: string, password: string) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error(authError.message);
      await bootstrap();
    },
    [bootstrap],
  );

  const signUp = React.useCallback(
    async (email: string, password: string, fullName: string) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data: result, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (authError) throw new Error(authError.message);
      return { needsConfirmation: !result.session };
    },
    [],
  );

  const signInWithOtp = React.useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase is not configured');
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    if (authError) throw new Error(authError.message);
  }, []);

  const signOut = React.useCallback(async () => {
    if (mode === 'demo') {
      setMode(supabaseReady ? 'supabase' : 'demo');
      setUser(null);
      setOrgs([]);
      setOrg(null);
      setRole(null);
      setData(EMPTY_DATA);
      return;
    }
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setOrgs([]);
    setOrg(null);
    setRole(null);
    setData(EMPTY_DATA);
  }, [mode]);

  const enterDemo = React.useCallback(() => {
    setMode('demo');
  }, []);

  const createOrg = React.useCallback(
    async (name: string, slug?: string) => {
      if (mode === 'demo') {
        mutateDemo((dataset) => ({
          ...dataset,
          org: { ...dataset.org, name, slug: slug || dataset.org.slug },
        }));
        return;
      }
      if (!supabase) throw new Error('Supabase is not configured');
      const { data: created, error: rpcError } = await supabase.rpc('create_organization', {
        org_name: name,
        org_slug: slug && slug.length > 1 ? slug : null,
      });
      if (rpcError) throw new Error(rpcError.message);
      const entries = await loadOrgs();
      setOrgs(entries);
      const match = entries.find((entry) => entry.org.id === (created as Organization).id);
      if (match) await applyOrg(match);
    },
    [mode, mutateDemo, loadOrgs, applyOrg],
  );

  const switchOrg = React.useCallback(
    async (orgId: string) => {
      const entry = orgs.find((candidate) => candidate.org.id === orgId);
      if (entry) await applyOrg(entry);
    },
    [orgs, applyOrg],
  );

  const saveLocation = React.useCallback(
    async (input: LocationInput, id?: string) => {
      const payload = {
        name: input.name,
        store_code: input.store_code || null,
        city: input.city || null,
        state: input.state || null,
        postal_code: input.postal_code || null,
        address_line1: input.address_line1 || null,
        phone: input.phone || null,
        website: input.website || null,
        primary_category: input.primary_category || null,
        description: input.description || null,
        status: input.status,
        ...(input.hours ? { hours: input.hours } : {}),
      };

      if (mode === 'demo') {
        mutateDemo((dataset) => {
          if (id) {
            return {
              ...dataset,
              locations: dataset.locations.map((location) =>
                location.id === id ? { ...location, ...payload, updated_at: new Date().toISOString() } : location,
              ),
              activity: [
                {
                  id: `local-${Date.now()}`,
                  org_id: dataset.org.id,
                  location_id: id,
                  actor_id: null,
                  kind: 'location.updated',
                  summary: `Updated ${payload.name}`,
                  meta: {},
                  created_at: new Date().toISOString(),
                },
                ...dataset.activity,
              ],
            };
          }
          const created: Location = {
            id: `local-${Date.now()}`,
            org_id: dataset.org.id,
            gbp_account_id: null,
            gbp_location_id: null,
            country: 'IN',
            additional_categories: [],
            attributes: {},
            hours: input.hours ?? {},
            photo_count: 0,
            last_photo_at: null,
            last_synced_at: null,
            audit_score: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payload,
          } as Location;
          return {
            ...dataset,
            locations: [...dataset.locations, created],
            activity: [
              {
                id: `local-${Date.now()}`,
                org_id: dataset.org.id,
                location_id: created.id,
                actor_id: null,
                kind: 'location.created',
                summary: `Added ${created.name}`,
                meta: {},
                created_at: new Date().toISOString(),
              },
              ...dataset.activity,
            ],
          };
        });
        return;
      }

      if (!supabase || !org) throw new Error('Supabase is not configured');
      const query = id
        ? supabase.from('locations').update(payload).eq('id', id)
        : supabase.from('locations').insert({ ...payload, org_id: org.id });
      const { error: writeError } = await query;
      if (writeError) throw new Error(writeError.message);
      await supabase.from('activity_events').insert({
        org_id: org.id,
        location_id: id ?? null,
        kind: id ? 'location.updated' : 'location.created',
        summary: `${id ? 'Updated' : 'Added'} ${payload.name}`,
        actor_id: user?.id ?? null,
      });
      await refresh();
    },
    [mode, mutateDemo, org, user, refresh],
  );

  const deleteLocation = React.useCallback(
    async (id: string) => {
      if (mode === 'demo') {
        mutateDemo((dataset) => ({
          ...dataset,
          locations: dataset.locations.filter((location) => location.id !== id),
          reviews: dataset.reviews.filter((review) => review.location_id !== id),
        }));
        return;
      }
      if (!supabase) throw new Error('Supabase is not configured');
      const { error: deleteError } = await supabase.from('locations').delete().eq('id', id);
      if (deleteError) throw new Error(deleteError.message);
      await refresh();
    },
    [mode, mutateDemo, refresh],
  );

  const bulkEdit = React.useCallback(
    async (input: BulkEditInput) => {
      const targets = data.locations.filter((location) => input.locationIds.includes(location.id));
      const jobId = `job-${Date.now()}`;
      const now = new Date().toISOString();

      if (mode === 'demo') {
        const updated = data.locations.map((location) => {
          if (!input.locationIds.includes(location.id)) return location;
          if (input.kind === 'hours' && input.hours) {
            return { ...location, hours: applyHoursPatch(location.hours, input.hours, input.keepClosedDays), updated_at: now };
          }
          if (input.kind === 'description') {
            return { ...location, description: input.description ?? location.description, updated_at: now };
          }
          if (input.kind === 'attributes') {
            return { ...location, attributes: { ...location.attributes, ...(input.attributes ?? {}) }, updated_at: now };
          }
          return { ...location, last_synced_at: now };
        });

        const job: BulkJob = {
          id: jobId,
          org_id: data.locations[0]?.org_id ?? '',
          kind: input.kind,
          status: 'succeeded',
          payload: { ...input } as Record<string, unknown>,
          total: targets.length,
          succeeded: targets.length,
          failed: 0,
          error: null,
          created_at: now,
          started_at: now,
          finished_at: now,
        };

        mutateDemo((dataset) => ({
          ...dataset,
          locations: updated,
          jobs: [job, ...dataset.jobs],
          activity: [
            {
              id: jobId,
              org_id: dataset.org.id,
              location_id: null,
              actor_id: null,
              kind: `bulk.${input.kind}`,
              summary: `Bulk ${input.kind} applied to ${targets.length} outlet(s)`,
              meta: { count: targets.length },
              created_at: now,
            },
            ...dataset.activity,
          ],
        }));
        return job;
      }

      if (!supabase || !org) throw new Error('Supabase is not configured');
      const { data: createdJob, error: jobError } = await supabase
        .from('bulk_jobs')
        .insert({
          org_id: org.id,
          kind: input.kind,
          status: 'running',
          payload: input as unknown as Record<string, unknown>,
          total: targets.length,
          created_by: user?.id ?? null,
          started_at: now,
        })
        .select()
        .single();
      if (jobError) throw new Error(jobError.message);

      let succeeded = 0;
      const failures: string[] = [];

      for (const location of targets) {
        const patch =
          input.kind === 'hours' && input.hours
            ? { hours: applyHoursPatch(location.hours, input.hours, input.keepClosedDays) }
            : input.kind === 'description'
              ? { description: input.description ?? location.description }
              : input.kind === 'attributes'
                ? { attributes: { ...location.attributes, ...(input.attributes ?? {}) } }
                : { last_synced_at: now };

        const { error: updateError } = await supabase.from('locations').update(patch).eq('id', location.id);
        if (updateError) {
          failures.push(`${location.name}: ${updateError.message}`);
          await supabase.from('bulk_job_items').insert({
            job_id: createdJob.id, org_id: org.id, location_id: location.id, status: 'failed', error: updateError.message,
          });
        } else {
          succeeded += 1;
          await supabase.from('bulk_job_items').insert({
            job_id: createdJob.id, org_id: org.id, location_id: location.id, status: 'succeeded',
          });
        }
      }

      const finishedAt = new Date().toISOString();
      const { data: finalJob } = await supabase
        .from('bulk_jobs')
        .update({
          status: failures.length === 0 ? 'succeeded' : succeeded === 0 ? 'failed' : 'succeeded',
          succeeded,
          failed: failures.length,
          error: failures.length ? failures.join('; ').slice(0, 500) : null,
          finished_at: finishedAt,
        })
        .eq('id', createdJob.id)
        .select()
        .single();

      await supabase.from('activity_events').insert({
        org_id: org.id,
        kind: `bulk.${input.kind}`,
        summary: `Bulk ${input.kind} applied to ${succeeded} of ${targets.length} outlet(s)`,
        actor_id: user?.id ?? null,
        meta: { failed: failures.length },
      });
      await refresh();
      return (finalJob as BulkJob) ?? (createdJob as BulkJob);
    },
    [data.locations, mode, mutateDemo, org, user, refresh],
  );

  const replyReview = React.useCallback(
    async (reviewId: string, text: string, source: 'ai' | 'rule' | 'human') => {
      const now = new Date().toISOString();
      if (mode === 'demo') {
        mutateDemo((dataset) => ({
          ...dataset,
          reviews: dataset.reviews.map((review) =>
            review.id === reviewId
              ? { ...review, reply_text: text, status: 'replied', replied_at: now, draft_source: source }
              : review,
          ),
          activity: [
            {
              id: `local-${Date.now()}`,
              org_id: dataset.org.id,
              location_id: dataset.reviews.find((r) => r.id === reviewId)?.location_id ?? null,
              actor_id: null,
              kind: 'review.replied',
              summary: 'Replied to a review',
              meta: { source },
              created_at: now,
            },
            ...dataset.activity,
          ],
        }));
        return;
      }
      if (!supabase) throw new Error('Supabase is not configured');
      const { error: updateError } = await supabase
        .from('reviews')
        .update({
          reply_text: text,
          status: 'replied',
          replied_at: now,
          replied_by: user?.id ?? null,
          draft_source: source,
        })
        .eq('id', reviewId);
      if (updateError) throw new Error(updateError.message);
      await refresh();
    },
    [mode, mutateDemo, user, refresh],
  );

  const setReviewStatus = React.useCallback(
    async (reviewId: string, nextStatus: Review['status']) => {
      if (mode === 'demo') {
        mutateDemo((dataset) => ({
          ...dataset,
          reviews: dataset.reviews.map((review) => (review.id === reviewId ? { ...review, status: nextStatus } : review)),
        }));
        return;
      }
      if (!supabase) throw new Error('Supabase is not configured');
      const { error: updateError } = await supabase.from('reviews').update({ status: nextStatus }).eq('id', reviewId);
      if (updateError) throw new Error(updateError.message);
      await refresh();
    },
    [mode, mutateDemo, refresh],
  );

  const inviteMember = React.useCallback(
    async (email: string, newRole: MemberRole) => {
      if (mode === 'demo') {
        mutateDemo((dataset) => ({
          ...dataset,
          members: [
            ...dataset.members,
            {
              org_id: dataset.org.id,
              user_id: `local-${Date.now()}`,
              role: newRole,
              created_at: new Date().toISOString(),
              profile: { full_name: email.split('@')[0], email },
            },
          ],
        }));
        return;
      }
      if (!supabase || !org) throw new Error('Supabase is not configured');
      const { error: rpcError } = await supabase.rpc('add_member_by_email', {
        target_org: org.id,
        invitee_email: email,
        new_role: newRole,
      });
      if (rpcError) throw new Error(rpcError.message);
      await refresh();
    },
    [mode, mutateDemo, org, refresh],
  );

  const removeMember = React.useCallback(
    async (userId: string) => {
      if (mode === 'demo') {
        mutateDemo((dataset) => ({ ...dataset, members: dataset.members.filter((m) => m.user_id !== userId) }));
        return;
      }
      if (!supabase || !org) throw new Error('Supabase is not configured');
      const { error: rpcError } = await supabase.rpc('remove_member', { target_org: org.id, member_id: userId });
      if (rpcError) throw new Error(rpcError.message);
      await refresh();
    },
    [mode, mutateDemo, org, refresh],
  );

  const updateOrg = React.useCallback(
    async (patch: Partial<Pick<Organization, 'name' | 'brand_color' | 'plan'>>) => {
      if (mode === 'demo') {
        mutateDemo((dataset) => ({ ...dataset, org: { ...dataset.org, ...patch } }));
        return;
      }
      if (!supabase || !org) throw new Error('Supabase is not configured');
      const { error: updateError } = await supabase.from('organizations').update(patch).eq('id', org.id);
      if (updateError) throw new Error(updateError.message);
      await refresh();
    },
    [mode, mutateDemo, org, refresh],
  );

  const syncNow = React.useCallback(
    async (locationIds?: string[]) => {
      const ids = locationIds ?? data.locations.map((location) => location.id);
      const now = new Date().toISOString();
      if (mode === 'demo') {
        mutateDemo((dataset) => ({
          ...dataset,
          locations: dataset.locations.map((location) =>
            ids.includes(location.id) ? { ...location, last_synced_at: now, status: 'active' } : location,
          ),
          connection: dataset.connection ? { ...dataset.connection, last_synced_at: now } : dataset.connection,
          activity: [
            {
              id: `local-${Date.now()}`,
              org_id: dataset.org.id,
              location_id: null,
              actor_id: null,
              kind: 'sync.completed',
              summary: `Synced ${ids.length} outlet(s) from Google Business Profile`,
              meta: { locations: ids.length },
              created_at: now,
            },
            ...dataset.activity,
          ],
        }));
        return;
      }
      if (!supabase || !org) throw new Error('Supabase is not configured');
      const { error: updateError } = await supabase
        .from('locations')
        .update({ last_synced_at: now })
        .in('id', ids);
      if (updateError) throw new Error(updateError.message);
      await supabase.from('connections').update({ last_synced_at: now }).eq('org_id', org.id);
      await supabase.from('activity_events').insert({
        org_id: org.id,
        kind: 'sync.completed',
        summary: `Synced ${ids.length} outlet(s) from Google Business Profile`,
        actor_id: user?.id ?? null,
      });
      await refresh();
    },
    [data.locations, mode, mutateDemo, org, user, refresh],
  );

  const value: StoreValue = {
    status,
    mode,
    error,
    user,
    orgs,
    org,
    role,
    data,
    signIn,
    signUp,
    signInWithOtp,
    signOut,
    enterDemo,
    createOrg,
    switchOrg,
    refresh,
    saveLocation,
    deleteLocation,
    bulkEdit,
    replyReview,
    setReviewStatus,
    inviteMember,
    removeMember,
    updateOrg,
    syncNow,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = React.useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside KendraProvider');
  return context;
}

/** Live audit results, computed from the same rule engine the tests cover. */
export function useAuditResults() {
  const { data } = useStore();
  return React.useMemo(() => {
    return data.locations.map((location) => {
      const locationReviews = data.reviews.filter((review) => review.location_id === location.id);
      const rated = locationReviews.filter((review) => review.rating > 0);
      const openNegative = locationReviews.filter(
        (review) => review.sentiment === 'negative' && review.status !== 'replied' && review.status !== 'ignored',
      ).length;
      const duplicates = data.locations.filter(
        (other) => other.id !== location.id && other.name.trim().toLowerCase() === location.name.trim().toLowerCase(),
      ).length;
      return {
        location,
        result: evaluateAudit({
          location,
          openNegativeReviews: openNegative,
          avgRating: rated.length ? rated.reduce((total, review) => total + review.rating, 0) / rated.length : 0,
          totalReviews: locationReviews.length,
          duplicateSuspects: duplicates,
        }),
      };
    });
  }, [data.locations, data.reviews]);
}
