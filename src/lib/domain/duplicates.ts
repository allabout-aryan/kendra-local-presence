import type { Location } from './types';

export interface DuplicateGroup {
  key: string;
  label: string;
  members: Location[];
  keeper: Location;
  mergeIds: string[];
  reason: string;
}

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(the|and|&|llp|pvt|private|ltd|limited)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function normaliseCity(city: string | null | undefined): string {
  return (city ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Two listings for the same store split ranking signals. This groups profiles
 * that share a normalised name within the same city and proposes the keeper:
 * the one with a Google location id and the most photos, then the oldest.
 */
export function findDuplicateGroups(locations: Location[]): DuplicateGroup[] {
  const buckets = new Map<string, Location[]>();
  for (const location of locations) {
    const key = `${normaliseName(location.name)}|${normaliseCity(location.city)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), location]);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, members] of buckets) {
    if (members.length < 2) continue;
    const ranked = [...members].sort((a, b) => {
      const score = (location: Location) =>
        (location.gbp_location_id ? 100 : 0) + location.photo_count + (location.description ? 5 : 0);
      const difference = score(b) - score(a);
      if (difference !== 0) return difference;
      return a.created_at.localeCompare(b.created_at);
    });
    const keeper = ranked[0];
    groups.push({
      key,
      label: `${members[0].name}${members[0].city ? ` · ${members[0].city}` : ''}`,
      members,
      keeper,
      mergeIds: ranked.slice(1).map((location) => location.id),
      reason:
        ranked.length > 1 && members.length === 2
          ? `Two profiles share this name${members[0].city ? ` in ${members[0].city}` : ''}. Merging keeps the stronger listing.`
          : `${members.length} profiles share this name${members[0].city ? ` in ${members[0].city}` : ''}.`,
    });
  }
  return groups.sort((a, b) => b.members.length - a.members.length);
}

export interface MergePlan {
  keeperId: string;
  mergeIds: string[];
  reviewsMoved: number;
  metricsMoved: number;
  ranksDropped: number;
}

export function planMerge(
  group: DuplicateGroup,
  counts: { reviews: Record<string, number>; metrics: Record<string, number>; ranks: Record<string, number> },
): MergePlan {
  return {
    keeperId: group.keeper.id,
    mergeIds: group.mergeIds,
    reviewsMoved: group.mergeIds.reduce((total, id) => total + (counts.reviews[id] ?? 0), 0),
    metricsMoved: group.mergeIds.reduce((total, id) => total + (counts.metrics[id] ?? 0), 0),
    ranksDropped: group.mergeIds.reduce((total, id) => total + (counts.ranks[id] ?? 0), 0),
  };
}
