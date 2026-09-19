import type { Page } from '@playwright/test';

export const layers = [
  { id: 'population', label: 'Population', unit: 'people', description: 'Population' },
  { id: 'housing_units', label: 'Housing units', unit: 'units', description: 'Housing units' },
];

function feature(id: string, i: number, type = 'block_group', metrics = { population: 1000 + i * 500, housing_units: 400 + i * 150 }) {
  const west = -77.03 + i * 0.01;
  return { type: 'Feature', id, geometry: { type: 'Polygon', coordinates: [[[west, 38.99], [west + 0.008, 38.99], [west + 0.008, 39.0], [west, 39.0], [west, 38.99]]] },
    properties: { geo_id: id, name: `Area ${id}`, geography_type: type, boundary_vintage: '2020-01-01', metrics, evidence: [] } };
}

// `count` block groups (bg1..bgN, values rising with index) and optionally one large CDP.
export async function mockAreas(page: Page, count: number, options: { cdp?: boolean } = {}) {
  await page.route('https://server.arcgisonline.com/**', route => route.abort());
  await page.route('**/api/places', route => route.fulfill({ json: { places: [], count: 0, source: {} } }));
  const features = Array.from({ length: count }, (_, i) => feature(`bg${i + 1}`, i));
  if (options.cdp) features.unshift(feature('cdp', 9, 'census_designated_place', { population: 81015, housing_units: 35150 }));
  await page.route('**/api/areas', route => route.fulfill({ json: { type: 'FeatureCollection', schema_version: '1.0', features } }));
  await page.route('**/api/layers', route => route.fulfill({ json: layers }));
}

export async function openSegmentation(page: Page) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Compare areas' }).click();
  return page.getByRole('region', { name: 'Segmentation' });
}
