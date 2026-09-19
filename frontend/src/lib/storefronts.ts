import type { Storefront } from '../services/api';

export const GROUPS = [
  { id: 'food', label: 'Food & drink', color: '#e11d48' },
  { id: 'shops', label: 'Shops', color: '#2563eb' },
  { id: 'beauty', label: 'Beauty & services', color: '#9333ea' },
  { id: 'finance', label: 'Banks & pharmacy', color: '#ca8a04' },
] as const;
export type GroupId = typeof GROUPS[number]['id'];
export const ALL_GROUPS: GroupId[] = GROUPS.map(group => group.id);

const FOOD = new Set(['amenity=restaurant', 'amenity=cafe', 'amenity=fast_food', 'amenity=bar', 'amenity=pub',
  'amenity=ice_cream', 'amenity=food_court', 'shop=coffee', 'shop=bakery', 'shop=deli', 'shop=confectionery', 'shop=pastry', 'shop=tea']);
const FINANCE = new Set(['amenity=bank', 'amenity=pharmacy', 'shop=chemist']);
const BEAUTY = new Set(['shop=hairdresser', 'shop=beauty', 'shop=cosmetics', 'shop=tattoo', 'shop=massage', 'shop=nails',
  'shop=laundry', 'shop=dry_cleaning', 'shop=tailor', 'shop=car_repair', 'shop=optician']);

// OSM tags are inconsistent, so grouping is deliberately coarse; everything unlisted is a "shop".
export function groupOf(item: Pick<Storefront, 'category_key' | 'category'>): GroupId {
  const tag = `${item.category_key}=${item.category}`;
  return FOOD.has(tag) ? 'food' : FINANCE.has(tag) ? 'finance' : BEAUTY.has(tag) ? 'beauty' : 'shops';
}
export const groupColor = (id: GroupId) => GROUPS.find(group => group.id === id)!.color;
export const prettyCategory = (category: string) => category.replaceAll('_', ' ');

export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// Other storefronts with the same OSM category within `radius` meters (the item itself is excluded).
export function nearbySame(all: Storefront[], item: Storefront, radius = 300): number {
  return all.filter(other => other.osm_id !== item.osm_id && other.category_key === item.category_key
    && other.category === item.category && distanceMeters(item, other) <= radius).length;
}

export function summarize(all: Storefront[], blockGroupId: string) {
  const inside = all.filter(item => item.block_group_id === blockGroupId);
  const groups = GROUPS.map(group => ({ ...group, count: inside.filter(item => groupOf(item) === group.id).length }));
  const categories = new Map<string, number>();
  for (const item of inside) categories.set(prettyCategory(item.category), (categories.get(prettyCategory(item.category)) ?? 0) + 1);
  const top = [...categories.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
  return { total: inside.length, groups, top };
}
