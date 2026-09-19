export interface Scale { comparative: boolean; min: number; max: number; opacity: (value: number) => number }
interface Comparable { properties: { geo_id: string; geography_type: string; metrics: Record<string, number | null> } }

const FLOOR = 0.15, CEILING = 0.75;
export const HIGH_PERCENTILE = 0.6;
// Finest unit first: when several types are comparable and tied, the finer one is preferred.
const FINEST_FIRST = ['block_group', 'census_tract', 'census_designated_place'];

// A comparative scale needs at least two areas whose values differ; otherwise fill only marks "has data".
export function makeScale(values: (number | null | undefined)[]): Scale {
  const present = values.filter((v): v is number => v != null);
  const min = Math.min(...present), max = Math.max(...present);
  const comparative = present.length >= 2 && max > min;
  return { comparative, min, max, opacity: value => comparative ? FLOOR + (CEILING - FLOOR) * (value - min) / (max - min) : 0.35 };
}

// Areas are only comparable within one geography type: a CDP total dwarfs any block group.
export function scalesByType(features: Comparable[], metric: string): Map<string, Scale> {
  const types = [...new Set(features.map(f => f.properties.geography_type))];
  return new Map(types.map(type => [type, makeScale(features.filter(f => f.properties.geography_type === type)
    .map(f => metric ? f.properties.metrics[metric] : null))]));
}

// The largest set of areas of ONE geography type that have a value for both layers.
export function comparableUnit<T extends Comparable>(features: T[], x: string, y: string): { type: string | null; features: T[] } {
  const groups = new Map<string, T[]>();
  for (const f of features) {
    if (f.properties.metrics[x] == null || f.properties.metrics[y] == null) continue;
    groups.set(f.properties.geography_type, [...(groups.get(f.properties.geography_type) ?? []), f]);
  }
  const rank = (type: string) => { const i = FINEST_FIRST.indexOf(type); return i < 0 ? FINEST_FIRST.length : i; };
  const best = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || rank(a[0]) - rank(b[0]))[0];
  return best ? { type: best[0], features: best[1] } : { type: null, features: [] };
}

// Linear-interpolated percentile of an ascending-sorted array.
function percentile(sorted: number[], p: number): number {
  const at = (sorted.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
}

// Areas at or above the 60th percentile in BOTH layers, ranked among comparable areas of one geography type.
// A layer with no spread has no "high" areas.
export function highInBoth(features: Comparable[], x: string, y: string): { compared: number; ids: string[] } {
  const unit = comparableUnit(features, x, y).features;
  const pairs = unit.map(f => ({ id: f.properties.geo_id, a: f.properties.metrics[x] as number, b: f.properties.metrics[y] as number }));
  const cut = (values: number[]) => {
    const sorted = [...values].sort((m, n) => m - n);
    return sorted[0] === sorted[sorted.length - 1] ? Infinity : percentile(sorted, HIGH_PERCENTILE);
  };
  const [cutA, cutB] = [cut(pairs.map(p => p.a)), cut(pairs.map(p => p.b))];
  return { compared: pairs.length, ids: pairs.filter(p => p.a >= cutA && p.b >= cutB).map(p => p.id) };
}
