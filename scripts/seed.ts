/**
 * Seeds a Supabase project with a demo brand so you can click through the real
 * (non-demo) data path. Requires the service role key — run it locally only.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm seed
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const OUTLETS = [
  { name: 'Indiranagar', code: 'BLR-01', city: 'Bengaluru', state: 'Karnataka', pin: '560038', photos: 34, rating: 4.6 },
  { name: 'Bandra West', code: 'BOM-01', city: 'Mumbai', state: 'Maharashtra', pin: '400050', photos: 18, rating: 4.1 },
  { name: 'Lower Parel', code: 'BOM-02', city: 'Mumbai', state: 'Maharashtra', pin: '400013', photos: 0, rating: 3.6 },
  { name: 'Koregaon Park', code: 'PNQ-01', city: 'Pune', state: 'Maharashtra', pin: '411001', photos: 27, rating: 4.7 },
  { name: 'Jubilee Hills', code: 'HYD-01', city: 'Hyderabad', state: 'Telangana', pin: '500033', photos: 41, rating: 4.8 },
];

async function main() {
  const email = process.env.SEED_EMAIL ?? 'demo@kendra.test';
  const password = process.env.SEED_PASSWORD ?? 'kendra-demo-1234';

  const { data: existing } = await supabase.auth.admin.listUsers();
  let user = existing.users.find((candidate) => candidate.email === email);
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'Aarti Rao' },
    });
    if (error) throw error;
    user = data.user;
  }
  if (!user) throw new Error('could not create the seed user');

  const slug = `kendra-demo-${Date.now().toString(36)}`;
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: 'Blue Tokai Retail', slug, created_by: user.id, plan: 'scale', seat_limit: 12 })
    .select()
    .single();
  if (orgError) throw orgError;

  await supabase.from('memberships').insert({ org_id: org.id, user_id: user.id, role: 'owner' });

  const { data: locations, error: locationError } = await supabase
    .from('locations')
    .insert(
      OUTLETS.map((outlet, index) => ({
        org_id: org.id,
        name: outlet.name,
        store_code: outlet.code,
        gbp_location_id: `seed-${index + 1}`,
        address_line1: `${10 + index * 7}, Main Road`,
        city: outlet.city,
        state: outlet.state,
        postal_code: outlet.pin,
        phone: `98765${String(43210 + index).padStart(5, '0')}`,
        website: 'https://bluetokai.com',
        primary_category: 'Coffee shop',
        description:
          'A neighbourhood roastery serving single-origin espresso, filter coffee and fresh bakes through the day, with small-batch roasting on site every Tuesday.',
        hours: {
          mon: { open: '08:00', close: '22:00' },
          tue: { open: '08:00', close: '22:00' },
          wed: { open: '08:00', close: '22:00' },
          thu: { open: '08:00', close: '22:00' },
          fri: { open: '08:00', close: '22:00' },
          sat: { open: '09:00', close: '23:00' },
          sun: { open: '09:00', close: '21:00' },
        },
        photo_count: outlet.photos,
        last_photo_at: outlet.photos ? new Date(Date.now() - index * 86_400_000 * 9).toISOString() : null,
        last_synced_at: new Date().toISOString(),
      })),
    )
    .select();
  if (locationError) throw locationError;

  const reviews = locations!.flatMap((location, index) => [
    {
      org_id: org.id,
      location_id: location.id,
      gbp_review_id: `seed-review-${location.id}-1`,
      author_name: 'Kavya Nair',
      rating: index % 2 === 0 ? 2 : 5,
      comment:
        index % 2 === 0
          ? 'Waited almost 40 minutes for a flat white and nobody acknowledged us.'
          : 'Excellent single origin pour over and the team explained the roast patiently.',
      sentiment: index % 2 === 0 ? 'negative' : 'positive',
      published_at: new Date(Date.now() - index * 86_400_000).toISOString(),
    },
  ]);
  await supabase.from('reviews').insert(reviews);

  await supabase.from('connections').insert({
    org_id: org.id,
    provider: 'google_business_profile',
    display_name: 'Blue Tokai Retail (seed)',
    status: 'connected',
    connected_at: new Date().toISOString(),
    last_synced_at: new Date().toISOString(),
  });

  console.log(`Seeded org ${org.id} (${slug}) with ${locations!.length} outlets.`);
  console.log(`Sign in with ${email} / ${password}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
