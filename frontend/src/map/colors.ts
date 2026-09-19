import type { Areas } from '../services/api';

export const palettes: Record<string, string[]> = {
  population: ['#d0e9e5', '#78b9b1', '#277d78', '#07504d'],
  housing_units: ['#e4ddf1', '#b59acc', '#82589f', '#512771'],
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
