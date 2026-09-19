import type { Areas } from '../services/api';
import type { Box } from './geocode';

type Ring = number[][];
type Shape = { type: string; coordinates: unknown };

function inRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[j];
    if ((y1 > lat) !== (y2 > lat) && lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

// Ray casting; the first ring of each polygon is its outer boundary and the rest are holes.
export function inGeometry(lon: number, lat: number, geometry: Shape): boolean {
  const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as Ring[][];
  return polygons.some(polygon => inRing(lon, lat, polygon[0]) && !polygon.slice(1).some(hole => inRing(lon, lat, hole)));
}

// The smallest containing area wins, so a block group is chosen over the CDP that surrounds it.
export function containingArea(areas: Areas, lon: number, lat: number) {
  const rank = (type: string) => type === 'block_group' ? 0 : type === 'census_tract' ? 1 : 2;
  return areas.features
    .filter(feature => inGeometry(lon, lat, feature.geometry as Shape))
    .sort((a, b) => rank(a.properties.geography_type) - rank(b.properties.geography_type))[0];
}

export function coverageBox(areas: Areas): Box {
  const box: Box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  for (const feature of areas.features) {
    const geometry = feature.geometry as Shape;
    const polygons = (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as Ring[][];
    for (const polygon of polygons) for (const [lon, lat] of polygon[0]) {
      box.west = Math.min(box.west, lon); box.east = Math.max(box.east, lon);
      box.south = Math.min(box.south, lat); box.north = Math.max(box.north, lat);
    }
  }
  return box;
}
