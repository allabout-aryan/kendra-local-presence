import type {
  ActivityEvent, AuditFinding, AuditSnapshot, BulkJob, Connection, ImportJob, Location, Membership,
  MetricSnapshot, Organization, Post, RankSnapshot, Review,
} from '@/lib/domain/types';
import { classifySentiment } from '@/lib/domain/reviews';
import { evaluateAudit } from '@/lib/domain/audit';
import type { BusinessHours } from '@/lib/domain/types';

/** Deterministic PRNG so the demo dataset is identical on every load. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ORG_ID = 'a0000000-0000-4000-8000-000000000001';

const weekday: BusinessHours = {
  mon: { open: '08:00', close: '22:00' },
  tue: { open: '08:00', close: '22:00' },
  wed: { open: '08:00', close: '22:00' },
  thu: { open: '08:00', close: '22:00' },
  fri: { open: '08:00', close: '22:00' },
  sat: { open: '09:00', close: '23:00' },
  sun: { open: '09:00', close: '21:00' },
};

interface Seed {
  name: string;
  code: string;
  city: string;
  state: string;
  pin: string;
  category: string;
  photos: number;
  photoAgeDays: number;
  hasDescription: boolean;
  hasPhone: boolean;
  hasHours: boolean;
  rating: number;
  reviews: number;
  traffic: number;
}

const SEEDS: Seed[] = [
  { name: 'Indiranagar', code: 'BLR-01', city: 'Bengaluru', state: 'Karnataka', pin: '560038', category: 'Coffee shop', photos: 34, photoAgeDays: 12, hasDescription: true, hasPhone: true, hasHours: true, rating: 4.6, reviews: 412, traffic: 1.0 },
  { name: 'Koramangala 5th Block', code: 'BLR-02', city: 'Bengaluru', state: 'Karnataka', pin: '560095', category: 'Coffee shop', photos: 21, photoAgeDays: 48, hasDescription: true, hasPhone: true, hasHours: true, rating: 4.4, reviews: 286, traffic: 0.86 },
  { name: 'Bandra West', code: 'BOM-01', city: 'Mumbai', state: 'Maharashtra', pin: '400050', category: 'Coffee shop', photos: 18, photoAgeDays: 104, hasDescription: true, hasPhone: true, hasHours: true, rating: 4.1, reviews: 508, traffic: 1.15 },
  { name: 'Lower Parel', code: 'BOM-02', city: 'Mumbai', state: 'Maharashtra', pin: '400013', category: 'Cafe', photos: 0, photoAgeDays: 400, hasDescription: false, hasPhone: true, hasHours: false, rating: 3.6, reviews: 173, traffic: 0.72 },
  { name: 'Koregaon Park', code: 'PNQ-01', city: 'Pune', state: 'Maharashtra', pin: '411001', category: 'Coffee shop', photos: 27, photoAgeDays: 21, hasDescription: true, hasPhone: true, hasHours: true, rating: 4.7, reviews: 198, traffic: 0.64 },
  { name: 'Baner Road', code: 'PNQ-02', city: 'Pune', state: 'Maharashtra', pin: '411045', category: 'Cafe', photos: 9, photoAgeDays: 76, hasDescription: false, hasPhone: false, hasHours: true, rating: 4.0, reviews: 94, traffic: 0.41 },
  { name: 'Jubilee Hills', code: 'HYD-01', city: 'Hyderabad', state: 'Telangana', pin: '500033', category: 'Coffee shop', photos: 41, photoAgeDays: 5, hasDescription: true, hasPhone: true, hasHours: true, rating: 4.8, reviews: 267, traffic: 0.93 },
  { name: 'Gachibowli', code: 'HYD-02', city: 'Hyderabad', state: 'Telangana', pin: '500032', category: 'Cafe', photos: 15, photoAgeDays: 33, hasDescription: true, hasPhone: true, hasHours: true, rating: 4.2, reviews: 121, traffic: 0.58 },
  { name: 'Connaught Place', code: 'DEL-01', city: 'New Delhi', state: 'Delhi', pin: '110001', category: 'Coffee shop', photos: 12, photoAgeDays: 141, hasDescription: true, hasPhone: true, hasHours: false, rating: 3.9, reviews: 341, traffic: 1.08 },
  { name: 'Sector 29 Gurugram', code: 'GGN-01', city: 'Gurugram', state: 'Haryana', pin: '122002', category: 'Cafe', photos: 6, photoAgeDays: 95, hasDescription: false, hasPhone: true, hasHours: true, rating: 3.8, reviews: 88, traffic: 0.37 },
];

const REVIEW_BODIES = [
  { rating: 2, text: 'Waited almost 40 minutes for a flat white. The staff seemed to be short-handed and nobody acknowledged us.' },
  { rating: 5, text: 'Excellent single origin pour over and the team explained the roast patiently. Best coffee in the neighbourhood.' },
  { rating: 1, text: 'The table was sticky and the washroom had a bad smell. Not what I expect at these prices.' },
  { rating: 4, text: 'Great coffee and quick service, though seating is hard to find on weekends.' },
  { rating: 3, text: 'Coffee was fine but the croissant was stale. Friendly staff though.' },
  { rating: 5, text: 'Lovely space, very clean, and the cold brew is genuinely the best I have had.' },
  { rating: 2, text: 'Overpriced for the portion size and the billing was wrong the first time.' },
  { rating: 5, text: 'Helpful staff, smooth pickup order, will recommend to friends.' },
  { rating: 1, text: 'Nobody responded to my calls for three days about a refund. Very disappointed.' },
  { rating: 4, text: 'Good experience overall. Parking is hard to find though.' },
  { rating: 5, text: 'Prompt service and amazing banana bread. Love this outlet.' },
  { rating: 3, text: 'It was fine. Nothing special, nothing bad.' },
  { rating: 2, text: 'My order was cold when it arrived and the delay was over 30 minutes.' },
  { rating: 5, text: 'Perfect flat white and friendly baristas. Quick service even at peak hours.' },
];

const AUTHORS = ['Kavya Nair', 'Rohan Mehta', 'Priya Iyer', 'Aditya Rao', 'Sneha Kulkarni', 'Vikram Singh', 'Ananya Das', 'Farhan Sheikh', 'Meera Joshi', 'Karthik Reddy', 'Ishita Bose', 'Nikhil Verma'];

const KEYWORDS = ['coffee near me', 'best cafe indiranagar', 'specialty coffee', 'brunch place', 'work friendly cafe'];

/** 30 days of score history per outlet, drifting a little each day. */
function buildAuditHistory(locations: Location[], iso: (daysAgo: number) => string): AuditSnapshot[] {
  const rows: AuditSnapshot[] = [];
  locations.forEach((location, locationIndex) => {
    for (let day = 29; day >= 0; day -= 1) {
      const drift = Math.round(Math.sin((day + locationIndex) / 3.2) * 4) + Math.floor((29 - day) / 12);
      rows.push({
        id: `hist-${locationIndex}-${day}`,
        org_id: location.org_id,
        location_id: location.id,
        captured_on: iso(day).slice(0, 10),
        score: Math.max(0, Math.min(100, location.audit_score + drift)),
      });
    }
  });
  return rows;
}

export interface DemoDataset {
  org: Organization;
  role: 'owner';
  locations: Location[];
  reviews: Review[];
  metrics: MetricSnapshot[];
  ranks: RankSnapshot[];
  findings: AuditFinding[];
  jobs: BulkJob[];
  activity: ActivityEvent[];
  members: Membership[];
  connection: Connection;
  posts: Post[];
  auditSnapshots: AuditSnapshot[];
  importJobs: ImportJob[];
}

export function buildDemoDataset(now = new Date()): DemoDataset {
  const rand = mulberry32(20261102);
  const iso = (daysAgo: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };

  const locations: Location[] = SEEDS.map((seed, index) => {
    const hours: BusinessHours = seed.hasHours
      ? { ...weekday }
      : { mon: { open: '09:00', close: '21:00' }, tue: { open: '09:00', close: '21:00' } };
    const base = {
      id: `10000000-0000-4000-8000-0000000000${String(index + 10).padStart(2, '0')}`,
      org_id: ORG_ID,
      name: seed.name,
      store_code: seed.code,
      gbp_account_id: 'accounts/1042',
      gbp_location_id: `locations/${1000 + index}`,
      address_line1: `${10 + index * 7}, ${seed.name} Main Road`,
      city: seed.city,
      state: seed.state,
      postal_code: seed.pin,
      country: 'IN',
      phone: seed.hasPhone ? `98${String(76543210 + index * 1111).slice(0, 8)}` : null,
      website: 'https://bluetokai.com',
      primary_category: seed.category,
      additional_categories: ['Cafe', 'Bakery'],
      description: seed.hasDescription
        ? `A neighbourhood roastery in ${seed.city} serving single-origin espresso, filter coffee and fresh bakes through the day. Small-batch roasting happens on site every Tuesday, and our team will happily walk you through the day's beans.`
        : null,
      hours,
      attributes: { wheelchair_accessible: index % 2 === 0, outdoor_seating: index % 3 === 0 },
      status: (index === 9 ? 'paused' : 'active') as Location['status'],
      photo_count: seed.photos,
      last_photo_at: seed.photos === 0 ? null : iso(seed.photoAgeDays),
      last_synced_at: iso(index % 3),
      audit_score: 0,
      created_at: iso(400 - index * 12),
      updated_at: iso(index % 5),
    } satisfies Location;
    return base;
  });

  // Reviews are sampled by outlet quality, so a well-run store reads like one:
  // mostly 4–5 stars with the occasional complaint, and the reverse for a store
  // that is struggling. This keeps the demo's ratings and audit scores coherent.
  const GOOD = REVIEW_BODIES.filter((body) => body.rating >= 4);
  const MID = REVIEW_BODIES.filter((body) => body.rating === 3);
  const BAD = REVIEW_BODIES.filter((body) => body.rating <= 2);

  function pickBody(rating: number, roll: number) {
    const weights = rating >= 4.5 ? [0.7, 0.2, 0.1] : rating >= 4 ? [0.5, 0.25, 0.25] : [0.25, 0.25, 0.5];
    const pools = [GOOD, MID, BAD];
    let cursor = roll;
    for (let index = 0; index < pools.length; index += 1) {
      if (cursor < weights[index]) {
        const pool = pools[index];
        return pool[Math.floor(rand() * pool.length) % pool.length];
      }
      cursor -= weights[index];
    }
    return MID[0];
  }

  const reviews: Review[] = [];
  let reviewCounter = 0;
  locations.forEach((location, locationIndex) => {
    const count = 3 + (locationIndex % 3);
    for (let i = 0; i < count; i += 1) {
      const body = pickBody(SEEDS[locationIndex].rating, rand());
      const author = AUTHORS[(reviewCounter * 3 + locationIndex) % AUTHORS.length];
      const daysAgo = 1 + Math.floor(rand() * 26);
      const status = reviewCounter % 4 === 0 ? 'replied' : reviewCounter % 5 === 0 ? 'ignored' : 'new';
      reviews.push({
        id: `20000000-0000-4000-8000-${String(reviewCounter).padStart(12, '0')}`,
        org_id: ORG_ID,
        location_id: location.id,
        author_name: author,
        rating: body.rating,
        comment: body.text,
        sentiment: classifySentiment(body.rating, body.text),
        status: status as Review['status'],
        draft_text: null,
        draft_source: null,
        reply_text: status === 'replied' ? 'Thank you for the feedback — we have shared this with the store team.' : null,
        replied_at: status === 'replied' ? iso(Math.max(0, daysAgo - 1)) : null,
        published_at: iso(daysAgo),
        location_name: location.name,
        location_city: location.city,
      });
      reviewCounter += 1;
    }
  });

  // metrics: 30 days per outlet
  const metrics: MetricSnapshot[] = [];
  locations.forEach((location, index) => {
    const seed = SEEDS[index];
    for (let day = 29; day >= 0; day -= 1) {
      const weekendBoost = [0, 6].includes(new Date(iso(day)).getDay()) ? 1.28 : 1;
      const drift = 1 + (29 - day) * 0.006;
      const noise = 0.82 + rand() * 0.36;
      const views = Math.round(seed.traffic * 420 * weekendBoost * drift * noise);
      metrics.push({
        id: `30000000-0000-4000-8000-${String(metrics.length).padStart(12, '0')}`,
        org_id: ORG_ID,
        location_id: location.id,
        captured_on: iso(day).slice(0, 10),
        views,
        searches: Math.round(views * 0.44),
        calls: Math.round(seed.traffic * 26 * weekendBoost * noise),
        direction_requests: Math.round(seed.traffic * 58 * weekendBoost * noise),
        website_clicks: Math.round(seed.traffic * 19 * noise),
        photo_views: Math.round(views * 0.61),
        avg_rating: seed.rating,
        review_count: seed.reviews,
      });
    }
  });

  // rank snapshots: latest capture per keyword per outlet
  const ranks: RankSnapshot[] = [];
  locations.forEach((location, index) => {
    KEYWORDS.forEach((keyword, k) => {
      const base = 2 + ((index + k) % 9);
      const position = index === 3 || index === 9 ? (k % 2 === 0 ? 0 : 14 + k) : base;
      const grid = Array.from({ length: 25 }).map((_, cell) => {
        const row = Math.floor(cell / 5);
        const col = cell % 5;
        const distance = Math.abs(row - 2) + Math.abs(col - 2);
        return { row, col, position: position === 0 ? 0 : Math.max(1, Math.min(20, position + distance - 1)) };
      });
      ranks.push({
        id: `40000000-0000-4000-8000-${String(ranks.length).padStart(12, '0')}`,
        org_id: ORG_ID,
        location_id: location.id,
        keyword,
        captured_on: iso(1).slice(0, 10),
        position,
        grid,
      });
    });
  });

  // audit findings, derived from the same engine the app uses
  const findings: AuditFinding[] = [];
  locations.forEach((location) => {
    const openNegative = reviews.filter(
      (r) => r.location_id === location.id && r.sentiment === 'negative' && r.status !== 'replied',
    ).length;
    // Same inputs the UI derives at runtime, so the stored score cannot drift
    // from the one on screen.
    const rated = reviews.filter((review) => review.location_id === location.id && review.rating > 0);
    const result = evaluateAudit({
      location,
      openNegativeReviews: openNegative,
      avgRating: rated.length ? rated.reduce((total, review) => total + review.rating, 0) / rated.length : 0,
      totalReviews: rated.length,
      duplicateSuspects: 0,
      now,
    });
    location.audit_score = result.score;
    for (const finding of result.findings) {
      findings.push({
        id: `50000000-0000-4000-8000-${String(findings.length).padStart(12, '0')}`,
        org_id: ORG_ID,
        location_id: location.id,
        rule_key: finding.rule_key,
        severity: finding.severity,
        title: finding.title,
        detail: finding.detail,
        points_lost: finding.points_lost,
        resolved: false,
        created_at: iso(2),
      });
    }
  });

  const activity: ActivityEvent[] = [
    { id: 'a1', org_id: ORG_ID, location_id: locations[1].id, actor_id: null, kind: 'bulk.hours', summary: 'Bulk hours updated on 4 outlets', meta: { count: 4 }, created_at: iso(1) },
    { id: 'a2', org_id: ORG_ID, location_id: locations[0].id, actor_id: null, kind: 'review.replied', summary: 'Replied to a 5★ review at Indiranagar', meta: {}, created_at: iso(2) },
    { id: 'a3', org_id: ORG_ID, location_id: null, actor_id: null, kind: 'sync.completed', summary: 'Synced 10 outlets from Google Business Profile', meta: { locations: 10 }, created_at: iso(3) },
    { id: 'a4', org_id: ORG_ID, location_id: locations[3].id, actor_id: null, kind: 'audit.flagged', summary: 'Lower Parel flagged: no photos, hours incomplete', meta: {}, created_at: iso(4) },
    { id: 'a5', org_id: ORG_ID, location_id: null, actor_id: null, kind: 'report.exported', summary: 'Weekly performance report exported', meta: {}, created_at: iso(6) },
  ];

  return {
    org: {
      id: ORG_ID,
      name: 'Blue Tokai Retail',
      slug: 'blue-tokai-retail',
      plan: 'scale',
      seat_limit: 12,
      brand_color: '#0E5B46',
      created_at: iso(420),
    },
    role: 'owner',
    locations,
    reviews,
    metrics,
    ranks,
    findings,
    jobs: [
      {
        id: 'j1', org_id: ORG_ID, kind: 'hours', status: 'succeeded',
        payload: { days: 7 }, total: 4, succeeded: 4, failed: 0, error: null,
        created_at: iso(1), started_at: iso(1), finished_at: iso(1),
      },
      {
        id: 'j2', org_id: ORG_ID, kind: 'description', status: 'failed',
        payload: {}, total: 3, succeeded: 1, failed: 2, error: 'Google rejected 2 updates: description contains a URL',
        created_at: iso(7), started_at: iso(7), finished_at: iso(7),
      },
    ],
    activity,
    posts: [
      {
        id: 'p1', org_id: ORG_ID, location_id: locations[0].id,
        body: 'New season, new beans: the Ratnagiri washed lot is on the bar from Friday. Come taste it before it sells out.',
        cta_type: 'learn_more', cta_url: 'https://bluetokai.com/lots',
        scheduled_for: iso(-2), status: 'published', published_at: iso(-2), error: null,
        created_at: iso(4), updated_at: iso(2), location_name: locations[0].name,
      },
      {
        id: 'p2', org_id: ORG_ID, location_id: locations[6].id,
        body: 'Sunday cupping at Jubilee Hills, 11am. Six beans, no charge, bring a friend.',
        cta_type: 'call', cta_url: null,
        scheduled_for: iso(-1), status: 'scheduled', published_at: null, error: null,
        created_at: iso(1), updated_at: iso(1), location_name: locations[6].name,
      },
      {
        id: 'p3', org_id: ORG_ID, location_id: locations[3].id,
        body: 'Lower Parel is open again after the refit — bigger bar, more seats, same flat white.',
        cta_type: 'none', cta_url: null,
        scheduled_for: null, status: 'draft', published_at: null, error: null,
        created_at: iso(0), updated_at: iso(0), location_name: locations[3].name,
      },
    ],
    auditSnapshots: buildAuditHistory(locations, iso),
    importJobs: [
      {
        id: 'i1', org_id: ORG_ID, filename: 'outlets-q3.csv', status: 'completed',
        total_rows: 12, imported: 10, failed: 2,
        errors: [
          { row: 4, field: 'postal_code', message: 'Indian PIN codes are 6 digits' },
          { row: 9, field: 'phone', message: 'Enter a 10-digit Indian mobile number' },
        ],
        created_at: iso(11), finished_at: iso(11),
      },
    ],
    members: [
      { org_id: ORG_ID, user_id: 'u1', role: 'owner', created_at: iso(400), profile: { full_name: 'Aarti Rao', email: 'aarti@bluetokai.test' } },
      { org_id: ORG_ID, user_id: 'u2', role: 'admin', created_at: iso(320), profile: { full_name: 'Mihir Shah', email: 'mihir@bluetokai.test' } },
      { org_id: ORG_ID, user_id: 'u3', role: 'member', created_at: iso(180), profile: { full_name: 'Rhea Kapoor', email: 'rhea@bluetokai.test' } },
      { org_id: ORG_ID, user_id: 'u4', role: 'viewer', created_at: iso(90), profile: { full_name: 'Priya Iyer', email: 'priya@bluetokai.test' } },
    ],
    connection: {
      id: 'c1', org_id: ORG_ID, provider: 'google_business_profile',
      external_account_id: 'accounts/1042', display_name: 'Blue Tokai Retail (10 locations)',
      status: 'connected', connected_at: iso(390), last_synced_at: iso(1),
    },
  };
}
