export interface GeoResult { label: string; lat: number; lon: number }
export interface Box { west: number; south: number; east: number; north: number }

// Nominatim usage policy: no autocomplete, at most one request per second, cache repeat queries.
const MIN_INTERVAL_MS = 1100;
const cache = new Map<string, GeoResult[]>();
let lastRequestAt = 0;
let chain: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Serialize requests so two searches can never go out closer together than the minimum interval.
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return task();
  });
  chain = run.catch(() => undefined);
  return run;
}

export async function geocode(query: string, box: Box): Promise<GeoResult[]> {
  const key = query.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const results = await schedule(async () => {
    const params = new URLSearchParams({ q: query.trim(), format: 'jsonv2', limit: '5', countrycodes: 'us', bounded: '1',
      viewbox: `${box.west},${box.north},${box.east},${box.south}` });
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Geocoder returned ${response.status}`);
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new Error('Unexpected geocoder response');
    return body.flatMap((item: { lat?: unknown; lon?: unknown; display_name?: unknown }) => {
      const lat = Number(item?.lat), lon = Number(item?.lon);
      const label = typeof item?.display_name === 'string' ? item.display_name : '';
      return Number.isFinite(lat) && Number.isFinite(lon) && label ? [{ label, lat, lon }] : [];
    });
  });
  cache.set(key, results);
  return results;
}
