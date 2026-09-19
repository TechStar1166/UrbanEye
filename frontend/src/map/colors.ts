import type { Areas } from '../services/api';

export const palettes: Record<string, string[]> = {
  population: ['#d0e9e5', '#78b9b1', '#277d78', '#07504d'],
  housing_units: ['#e4ddf1', '#b59acc', '#82589f', '#512771'],
  median_household_income: ['#fef3c7', '#fbbf24', '#d97706', '#92400e'],
  age_50_plus_pct: ['#dbeafe', '#60a5fa', '#2563eb', '#1e3a8a'],
  avg_household_size: ['#ccfbf1', '#2dd4bf', '#0f766e', '#134e4a'],
  renter_occupied_pct: ['#fce7f3', '#f472b6', '#db2777', '#9d174d'],
};

export const strokes: Record<string, string> = {
  population: '#087e8b',
  housing_units: '#8f4bb8',
  median_household_income: '#b45309',
  age_50_plus_pct: '#1d4ed8',
  avg_household_size: '#0f766e',
  renter_occupied_pct: '#be185d',
};

export function colorScale(areas: Areas, metric: string) {
  // Compare like geographic units only; the encompassing CDP stays neutral.
  const values = areas.features.filter(f => f.properties.geography_type === 'block_group')
    .map(f => f.properties.metrics[metric]).filter((v): v is number => v != null);
  return { min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0, n: values.length };
}
export function areaColor(value: number | null | undefined, metric: string, scale: ReturnType<typeof colorScale>) {
  if (value == null || !palettes[metric]) return '#d9dfdc';
  const index = scale.max === scale.min ? 1 : Math.min(3, Math.floor(4 * (value - scale.min) / (scale.max - scale.min)));
  return palettes[metric][Math.max(0, index)];
}
