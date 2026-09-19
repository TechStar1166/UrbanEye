import type { components } from '../api.generated';

export type Area = components['schemas']['Area'];
export type Areas = components['schemas']['Areas'];
export type Layer = components['schemas']['Layer'];
export type Answer = components['schemas']['Answer'];
export type Evidence = components['schemas']['Evidence'];
export type History = components['schemas']['HistoryResponse'];
export type HistoryPoint = components['schemas']['HistoryPoint'];
export type Change = components['schemas']['ChangeResponse'];
export type Businesses = components['schemas']['BusinessResponse'];
export type Overlays = components['schemas']['OverlayResponse'];
export type Transit = components['schemas']['TransitResponse'];

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Request failed (${response.status}). Please try again.`);
  return response.json() as Promise<T>;
}

export const api = {
  areas: () => request<Areas>('/areas'),
  layers: () => request<Layer[]>('/layers'),
  area: (id: string) => request<Area>(`/areas/${encodeURIComponent(id)}`),
  ask: (geo_id: string, question: string) => request<Answer>('/ask', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geo_id, question }),
  }),
  history: (geo_id: string, metric: string) =>
    request<History>(`/areas/${encodeURIComponent(geo_id)}/history?metric=${encodeURIComponent(metric)}`),
  changes: (geo_id: string, metric: string, from_year: number, to_year: number) =>
    request<Change>(`/areas/${encodeURIComponent(geo_id)}/changes?metric=${encodeURIComponent(metric)}`
      + `&from_year=${from_year}&to_year=${to_year}`),
  businesses: (geo_id: string) => request<Businesses>(`/areas/${encodeURIComponent(geo_id)}/businesses`),
  pois: () => request<Businesses>('/pois'),
  overlays: () => request<Overlays>('/overlays'),
  transit: () => request<Transit>('/transit'),
};
