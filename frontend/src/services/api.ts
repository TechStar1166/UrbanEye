import type { components } from '../api.generated';

export type Area = components['schemas']['Area'];
export type Areas = components['schemas']['Areas'];
export type Layer = components['schemas']['Layer'];
export type Answer = components['schemas']['Answer'];
export type Evidence = components['schemas']['Evidence'];
export type Storefront = components['schemas']['Storefront'];
export type Storefronts = components['schemas']['Storefronts'];
export type SegmentResponse = components['schemas']['SegmentResponse'];

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Request failed (${response.status}). Please try again.`);
  return response.json() as Promise<T>;
}

export type Place = { id: string; name: string; kind: string; lat: number; lon: number; url: string };
export type Places = { places: Place[]; count: number; source: { downloaded_at: string } };
export type Source = { name: string; url: string | null; pulled: string | null; vintage: string; use: string; note: string; query?: string };
export const api = {
  places: () => request<Places>('/places'),
  sources: () => request<Source[]>('/sources'),
  areas: () => request<Areas>('/areas'),
  layers: () => request<Layer[]>('/layers'),
  storefronts: () => request<Storefronts>('/storefronts'),
  area: (id: string) => request<Area>(`/areas/${encodeURIComponent(id)}`),
  ask: (geo_id: string, question: string) => request<Answer>('/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geo_id, question }),
  }),
  segment: (geo_ids: string[], x_metric: string, y_metric: string) => request<SegmentResponse>('/segment', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geo_ids, x_metric, y_metric }),
  }),
};
