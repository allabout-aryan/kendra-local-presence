export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type LocationStatus = 'active' | 'paused' | 'pending_sync' | 'disconnected';
export type ReviewStatus = 'new' | 'drafted' | 'replied' | 'ignored' | 'escalated';
export type Sentiment = 'positive' | 'neutral' | 'negative';
export type JobKind = 'hours' | 'attributes' | 'description' | 'photos' | 'posts' | 'sync';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type Severity = 'info' | 'warning' | 'critical';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'trial' | 'growth' | 'scale' | 'enterprise';
  seat_limit: number;
  brand_color: string;
  created_at: string;
}

export interface Location {
  id: string;
  org_id: string;
  name: string;
  store_code: string | null;
  gbp_account_id: string | null;
  gbp_location_id: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  website: string | null;
  primary_category: string | null;
  additional_categories: string[];
  description: string | null;
  hours: BusinessHours;
  attributes: Record<string, boolean | string>;
  status: LocationStatus;
  photo_count: number;
  last_photo_at: string | null;
  last_synced_at: string | null;
  audit_score: number;
  created_at: string;
  updated_at: string;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type BusinessHours = Partial<Record<Weekday, { open: string; close: string } | null>>;

export interface LocationHealth {
  id: string;
  org_id: string;
  name: string;
  store_code: string | null;
  city: string | null;
  state: string | null;
  status: LocationStatus;
  audit_score: number;
  photo_count: number;
  last_synced_at: string | null;
  primary_category: string | null;
  open_reviews: number;
  negative_open: number;
  total_reviews: number;
  avg_rating: number;
  calls_30d: number;
  directions_30d: number;
  views_30d: number;
  searches_30d: number;
  website_clicks_30d: number;
  metrics_captured_on: string | null;
}

export interface Review {
  id: string;
  org_id: string;
  location_id: string;
  author_name: string;
  rating: number;
  comment: string | null;
  sentiment: Sentiment;
  status: ReviewStatus;
  draft_text: string | null;
  draft_source: 'ai' | 'rule' | 'human' | null;
  reply_text: string | null;
  replied_at: string | null;
  published_at: string;
  location_name?: string;
  location_city?: string | null;
}

export interface AuditFinding {
  id: string;
  org_id: string;
  location_id: string;
  rule_key: string;
  severity: Severity;
  title: string;
  detail: string | null;
  points_lost: number;
  resolved: boolean;
  created_at: string;
}

export interface MetricSnapshot {
  id: string;
  org_id: string;
  location_id: string;
  captured_on: string;
  views: number;
  searches: number;
  calls: number;
  direction_requests: number;
  website_clicks: number;
  photo_views: number;
  avg_rating: number;
  review_count: number;
}

export interface RankSnapshot {
  id: string;
  org_id: string;
  location_id: string;
  keyword: string;
  captured_on: string;
  position: number;
  grid: RankCell[] | null;
}

export interface RankCell {
  row: number;
  col: number;
  position: number;
}

export interface BulkJob {
  id: string;
  org_id: string;
  kind: JobKind;
  status: JobStatus;
  payload: Record<string, unknown>;
  total: number;
  succeeded: number;
  failed: number;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface ActivityEvent {
  id: string;
  org_id: string;
  location_id: string | null;
  actor_id: string | null;
  kind: string;
  summary: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface Connection {
  id: string;
  org_id: string;
  provider: string;
  external_account_id: string | null;
  display_name: string | null;
  status: 'disconnected' | 'connected' | 'error' | 'expired';
  connected_at: string | null;
  last_synced_at: string | null;
}

export interface Membership {
  org_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  profile?: { full_name: string | null; email: string | null };
}

export interface PortfolioRollup {
  org_id: string;
  locations_total: number;
  locations_active: number;
  avg_audit_score: number;
  min_audit_score: number;
  open_reviews: number;
  negative_open_reviews: number;
  avg_rating: number;
  calls_30d: number;
  directions_30d: number;
  views_30d: number;
  last_synced_at: string | null;
}

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type ImportStatus = 'queued' | 'previewed' | 'running' | 'completed' | 'failed';

export interface Post {
  id: string;
  org_id: string;
  location_id: string;
  body: string;
  cta_type: string | null;
  cta_url: string | null;
  scheduled_for: string | null;
  status: PostStatus;
  published_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  location_name?: string;
}

export interface AuditSnapshot {
  id: string;
  org_id: string;
  location_id: string;
  captured_on: string;
  score: number;
}

export interface ImportJob {
  id: string;
  org_id: string;
  filename: string | null;
  status: ImportStatus;
  total_rows: number;
  imported: number;
  failed: number;
  errors: { row: number; field: string; message: string }[];
  created_at: string;
  finished_at: string | null;
}

export interface ScoreTrendPoint {
  captured_on: string;
  avg_score: number;
  outlets: number;
}
